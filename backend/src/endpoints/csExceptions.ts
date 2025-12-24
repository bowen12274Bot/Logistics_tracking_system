import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { computeRoute } from "./mapRoute";
import { requireCustomerService } from "../utils/authUtils";

type NodeRow = { id: string; level: number };
type EdgeRow = { source: string; target: string };

async function findRootHub(db: D1Database, startNodeId: string) {
  const start = String(startNodeId ?? "").trim().toUpperCase();
  if (!start) return null;

  const nodesRes = await db.prepare("SELECT id, level FROM nodes").all();
  const edgesRes = await db.prepare("SELECT source, target FROM edges").all();
  const nodes = (nodesRes.results || []) as NodeRow[];
  const edges = (edgesRes.results || []) as EdgeRow[];

  const levelById = new Map<string, number>();
  for (const n of nodes) levelById.set(String(n.id).trim().toUpperCase(), Number(n.level));

  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const e of edges) {
    const a = String(e.source).trim().toUpperCase();
    const b = String(e.target).trim().toUpperCase();
    if (!a || !b) continue;
    add(a, b);
    add(b, a);
  }

  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const lvl = levelById.get(node);
    if (lvl === 1) return node;
    for (const nei of adj.get(node) ?? []) {
      if (visited.has(nei)) continue;
      visited.add(nei);
      queue.push(nei);
    }
  }

  return null;
}

async function assignDriverForNode(db: D1Database, fromNodeId: string) {
  const hub = await findRootHub(db, fromNodeId);
  if (!hub) return null;
  const drv = await db.prepare("SELECT id FROM users WHERE user_class = 'driver' AND UPPER(address) = ? LIMIT 1")
    .bind(String(hub).toUpperCase())
    .first<{ id: string }>();
  return drv?.id ?? null;
}

async function hasActiveTask(db: D1Database, packageId: string) {
  const row = await db.prepare(
    "SELECT 1 AS ok FROM delivery_tasks WHERE package_id = ? AND status IN ('pending','accepted','in_progress') LIMIT 1",
  )
    .bind(packageId)
    .first<{ ok: number }>();
  return Boolean(row);
}

async function getActiveCargoVehicle(db: D1Database, packageId: string) {
  const row = await db.prepare(
    `
    SELECT v.id AS vehicle_id, v.vehicle_code, v.current_node_id, v.driver_user_id
    FROM vehicle_cargo vc
    JOIN vehicles v ON v.id = vc.vehicle_id
    WHERE vc.package_id = ?
      AND vc.unloaded_at IS NULL
    ORDER BY vc.loaded_at DESC
    LIMIT 1
    `,
  )
    .bind(packageId)
    .first<{ vehicle_id: string; vehicle_code: string; current_node_id: string | null; driver_user_id: string }>();
  return row ?? null;
}

export class CustomerServiceExceptionList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Customer service exception pool list",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        handled: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireCustomerService(c);
    if (auth.ok === false) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const handled = data.query.handled;
    const limit = data.query.limit;

    const where: string[] = [];
    const params: any[] = [];
    if (handled !== undefined) {
      where.push("pe.handled = ?");
      params.push(handled ? 1 : 0);
    } else {
      where.push("pe.handled = 0");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await c.env.DB.prepare(
      `
      SELECT
        pe.*,
        p.tracking_number,
        p.status AS package_status,
        p.sender_address,
        p.receiver_address,
        (
          SELECT v.vehicle_code
          FROM vehicle_cargo vc
          JOIN vehicles v ON v.id = vc.vehicle_id
          WHERE vc.package_id = pe.package_id
            AND vc.unloaded_at IS NULL
          ORDER BY vc.loaded_at DESC
          LIMIT 1
        ) AS active_vehicle_code,
        (
          SELECT v.current_node_id
          FROM vehicle_cargo vc
          JOIN vehicles v ON v.id = vc.vehicle_id
          WHERE vc.package_id = pe.package_id
            AND vc.unloaded_at IS NULL
          ORDER BY vc.loaded_at DESC
          LIMIT 1
        ) AS active_vehicle_node_id,
        (
          SELECT dt.task_type
          FROM delivery_tasks dt
          WHERE dt.package_id = pe.package_id
            AND dt.status = 'canceled'
          ORDER BY COALESCE(dt.updated_at, dt.created_at, '') DESC
          LIMIT 1
        ) AS last_canceled_task_type,
        (
          SELECT dt.from_location
          FROM delivery_tasks dt
          WHERE dt.package_id = pe.package_id
            AND dt.status = 'canceled'
          ORDER BY COALESCE(dt.updated_at, dt.created_at, '') DESC
          LIMIT 1
        ) AS last_canceled_from_location,
        (
          SELECT dt.to_location
          FROM delivery_tasks dt
          WHERE dt.package_id = pe.package_id
            AND dt.status = 'canceled'
          ORDER BY COALESCE(dt.updated_at, dt.created_at, '') DESC
          LIMIT 1
        ) AS last_canceled_to_location
      FROM package_exceptions pe
      JOIN packages p ON p.id = pe.package_id
      ${whereSql}
      ORDER BY COALESCE(pe.reported_at, '') DESC
      LIMIT ?
      `,
    )
      .bind(...params, limit)
      .all();

    return c.json({ success: true, exceptions: rows.results ?? [] });
  }
}

export class CustomerServiceExceptionHandle extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Customer service handle an exception (resolve + decide next action)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        exceptionId: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              action: z.enum(["resume", "cancel"]),
              handling_report: z.string().min(1),
              resume_mode: z.enum(["continue_segment", "reroute_next_hop", "redirect_destination"]).optional(),
              next_hop_override: z.string().optional(),
              destination_override: z.string().optional(),
              cancel_reason: z.enum(["destroy"]).optional(),
              location: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "OK" },
      "400": { description: "Invalid request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireCustomerService(c);
    if (auth.ok === false) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const exceptionId = String(data.params.exceptionId).trim();
    const body = data.body as {
      action: "resume" | "cancel";
      handling_report: string;
      resume_mode?: "continue_segment" | "reroute_next_hop" | "redirect_destination";
      next_hop_override?: string;
      destination_override?: string;
      cancel_reason?: "destroy";
      location?: string;
    };

    const record = await c.env.DB.prepare(
      "SELECT id, package_id, handled, reason_code FROM package_exceptions WHERE id = ? LIMIT 1",
    )
      .bind(exceptionId)
      .first<{ id: string; package_id: string; handled: number; reason_code: string | null }>();
    if (!record) return c.json({ error: "Exception not found" }, 404);
    if (Number(record.handled) === 1) return c.json({ error: "Already handled" }, 409);

    const pkg = await c.env.DB.prepare("SELECT status FROM packages WHERE id = ? LIMIT 1")
      .bind(record.package_id)
      .first<{ status: string | null }>();
    const pkgStatus = String(pkg?.status ?? "").trim().toLowerCase();
    if (pkgStatus && ["delivered", "delivery_failed"].includes(pkgStatus)) {
      return c.json({ error: "Package is terminal", status: pkgStatus }, 409);
    }

    const now = new Date().toISOString();
    if (body.action === "cancel" && body.cancel_reason !== "destroy") {
      return c.json({ error: "cancel_reason must be 'destroy' for cancel" }, 400);
    }

    let persistedResumeMode: "continue_segment" | "reroute_next_hop" | "redirect_destination" | null = null;
    let persistedNextHopOverride: string | null = null;
    let persistedDestinationOverride: string | null = null;

    if (body.action === "resume") {
      if (await hasActiveTask(c.env.DB, record.package_id)) {
        return c.json({ error: "Package already has an active task" }, 409);
      }

      const resumeMode = body.resume_mode ?? "continue_segment";
      persistedResumeMode = resumeMode;
      const fallbackLocation = String(body.location ?? "").trim().toUpperCase();
      const exceptionLocRow = await c.env.DB.prepare(
        `
        SELECT location
        FROM package_events
        WHERE package_id = ?
          AND delivery_status = 'exception'
        ORDER BY events_at DESC
        LIMIT 1
        `,
      )
        .bind(record.package_id)
        .first<{ location: string | null }>();
      const exceptionLoc = String(exceptionLocRow?.location ?? "").trim().toUpperCase();

      const activeCargoVehicle = await getActiveCargoVehicle(c.env.DB, record.package_id);

      // Resolve the locked start location:
      // - If cargo is on truck, use vehicle.current_node_id (arrived-but-not-unloaded stays on truck).
      // - Else use exception event location (node) or fallback to provided body.location.
      let startNodeId = "";
      if (activeCargoVehicle) {
        startNodeId = String(activeCargoVehicle.current_node_id ?? "").trim().toUpperCase();
      } else {
        startNodeId = exceptionLoc;
        if (/^TRUCK_/i.test(exceptionLoc)) {
          const vehicle = await c.env.DB.prepare(
            "SELECT current_node_id FROM vehicles WHERE UPPER(vehicle_code) = ? LIMIT 1",
          )
            .bind(exceptionLoc.toUpperCase())
            .first<{ current_node_id: string | null }>();
          startNodeId = String(vehicle?.current_node_id ?? "").trim().toUpperCase();
        }
      }
      if (!startNodeId) startNodeId = fallbackLocation;
      if (!startNodeId) return c.json({ error: "Cannot resolve resume start location" }, 409);

      const pkgRow = await c.env.DB.prepare(
        "SELECT sender_address, receiver_address FROM packages WHERE id = ? LIMIT 1",
      )
        .bind(record.package_id)
        .first<{ sender_address: string | null; receiver_address: string | null }>();
      const sender = String(pkgRow?.sender_address ?? "").trim().toUpperCase();
      const receiver = String(pkgRow?.receiver_address ?? "").trim().toUpperCase();
      if (!receiver) return c.json({ error: "Package has no receiver_address" }, 409);

      // Prefer "re-issuing the last canceled segment" when the package is still on a truck:
      // the driver should be able to continue the same segment and/or dropoff (unload) at its destination node.
      const lastCanceled = await c.env.DB.prepare(
        `
        SELECT task_type, from_location, to_location
        FROM delivery_tasks
        WHERE package_id = ?
          AND status = 'canceled'
          AND to_location IS NOT NULL
        ORDER BY COALESCE(updated_at, created_at, '') DESC
        LIMIT 1
        `,
      )
        .bind(record.package_id)
        .first<{ task_type: string | null; from_location: string | null; to_location: string | null }>();

      let toNodeId: string | null = null;
      const canceledFrom = String(lastCanceled?.from_location ?? "").trim().toUpperCase();
      const canceledTo = String(lastCanceled?.to_location ?? "").trim().toUpperCase();

      let effectiveDestination = receiver;
      let destinationOverride: string | null = null;

      if (resumeMode === "redirect_destination") {
        destinationOverride = String(body.destination_override ?? "").trim().toUpperCase() || null;
        if (!destinationOverride) {
          if (!sender) return c.json({ error: "Package has no sender_address for return-to-origin" }, 409);
          destinationOverride = sender;
        }

        const destExists = await c.env.DB.prepare("SELECT 1 FROM nodes WHERE UPPER(id) = ? LIMIT 1")
          .bind(destinationOverride)
          .first();
        if (!destExists) {
          return c.json({ error: "destination_override not found", destination_override: destinationOverride }, 400);
        }
        effectiveDestination = destinationOverride;
        persistedDestinationOverride = destinationOverride;
      }

      if (resumeMode === "continue_segment") {
        if (activeCargoVehicle && canceledTo) {
          // Re-issue the same segment while cargo is still loaded: do NOT jump to next hop.
          toNodeId = canceledTo;
        } else if (canceledFrom === startNodeId && canceledTo) {
          toNodeId = canceledTo;
        }
      }

      if (resumeMode === "reroute_next_hop") {
        const nextHopOverride = String(body.next_hop_override ?? "").trim().toUpperCase();
        if (!nextHopOverride) {
          return c.json({ error: "next_hop_override is required for reroute_next_hop" }, 400);
        }

        const edgeOk = await c.env.DB.prepare(
          `
          SELECT 1 AS ok
          FROM edges
          WHERE (UPPER(source) = ? AND UPPER(target) = ?)
             OR (UPPER(source) = ? AND UPPER(target) = ?)
          LIMIT 1
          `,
        )
          .bind(startNodeId, nextHopOverride, nextHopOverride, startNodeId)
          .first<{ ok: number }>();
        if (!edgeOk) {
          return c.json(
            { error: "next_hop_override must be adjacent to start", start: startNodeId, next: nextHopOverride },
            400,
          );
        }
        toNodeId = nextHopOverride;
        persistedNextHopOverride = nextHopOverride;
      }

      if (!toNodeId) {
        const route = await computeRoute(c.env.DB, startNodeId, effectiveDestination);
        if (route.ok === false || route.path.length < 2) {
          return c.json(
            { error: "Route not found for resume", from: startNodeId, to: effectiveDestination },
            400,
          );
        }
        toNodeId = String(route.path[1]).trim().toUpperCase() || null;
      }

      if (!toNodeId) return c.json({ error: "Route not found for resume" }, 400);
      if (startNodeId === effectiveDestination) {
        return c.json({ error: "Already at destination" }, 409);
      }

      const assignedDriverId = await assignDriverForNode(c.env.DB, startNodeId);
      const maxSeg = await c.env.DB.prepare(
        "SELECT MAX(COALESCE(segment_index, 0)) AS max_seg FROM delivery_tasks WHERE package_id = ?",
      )
        .bind(record.package_id)
        .first<{ max_seg: number | null }>();
      const nextIndex = Number(maxSeg?.max_seg ?? -1) + 1;
      const taskType =
        String(lastCanceled?.task_type ?? "").trim() || (/^END_/i.test(startNodeId) ? "pickup" : "deliver");
      const taskId = crypto.randomUUID();

      const assignedDriverForResume = activeCargoVehicle?.driver_user_id ?? assignedDriverId;
      const statusForResume = activeCargoVehicle ? "in_progress" : "pending";
      await c.env.DB.prepare(
        `
        INSERT INTO delivery_tasks (
          id, package_id, task_type, from_location, to_location,
          assigned_driver_id, status, segment_index, created_at, updated_at,
          instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          taskId,
          record.package_id,
          taskType,
          startNodeId,
          toNodeId,
          assignedDriverForResume,
          statusForResume,
          nextIndex,
          now,
          now,
          body.handling_report,
        )
        .run();

      if (resumeMode === "redirect_destination" && destinationOverride) {
        await c.env.DB.prepare("UPDATE packages SET receiver_address = ? WHERE id = ?")
          .bind(destinationOverride, record.package_id)
          .run();
      }
    }

    await c.env.DB.prepare(
      `
      UPDATE package_exceptions
      SET handled = 1,
          handled_by = ?,
          handled_at = ?,
          handling_report = ?,
          resolution_action = ?,
          resume_mode = ?,
          next_hop_override = ?,
          destination_override = ?
      WHERE id = ?
      `,
    )
      .bind(
        auth.user.id,
        now,
        body.handling_report,
        body.action === "cancel"
          ? "destroy"
          : (persistedResumeMode === "redirect_destination"
              ? (String(body.destination_override ?? "").trim() ? "redirect_destination" : "return_to_origin")
              : (persistedResumeMode === "reroute_next_hop" ? "reroute_next_hop" : "resume_original")),
        body.action === "resume" ? persistedResumeMode : null,
        body.action === "resume" ? persistedNextHopOverride : null,
        body.action === "resume" ? persistedDestinationOverride : null,
        exceptionId,
      )
      .run();

    if (body.action === "cancel") {
      await c.env.DB.prepare(
        `
        UPDATE delivery_tasks
        SET status = 'canceled', updated_at = ?
        WHERE package_id = ?
          AND status IN ('pending','accepted','in_progress')
        `,
      )
        .bind(now, record.package_id)
        .run();
    }

    const eventId = crypto.randomUUID();
    const normalizedLocation = String(body.location ?? "").trim().toUpperCase();
    const details =
      body.action === "cancel"
        ? "異常已結案：客服取消委託（銷毀）"
        : `異常已結案：客服已重啟配送（${persistedResumeMode ?? "continue_segment"}）`;

    const resolvedLocRow = await c.env.DB.prepare(
      `
      SELECT location
      FROM package_events
      WHERE package_id = ?
        AND delivery_status = 'exception'
      ORDER BY events_at DESC
      LIMIT 1
      `,
    )
      .bind(record.package_id)
      .first<{ location: string | null }>();
    const exceptionEventLocation = String(resolvedLocRow?.location ?? "").trim().toUpperCase() || null;
    // Prefer CS-provided location for exception_resolved: it affects stage mapping (e.g. HUB/REG -> warehouse_in).
    const resolvedLocation = normalizedLocation || exceptionEventLocation || null;
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, 'exception_resolved', ?, ?, ?)
      `,
    )
      .bind(eventId, record.package_id, details, now, resolvedLocation)
      .run();

    let deliveryFailedEventId: string | null = null;
    if (body.action === "cancel") {
      const now2 = new Date(Date.parse(now) + 1).toISOString();
      const reason = String(record.reason_code ?? "").trim();
      const failedDetails = reason ? `配送失敗（銷毀）[${reason}]` : "配送失敗（銷毀）";

      deliveryFailedEventId = crypto.randomUUID();
      await c.env.DB.prepare(
        `
        INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
        VALUES (?, ?, 'delivery_failed', ?, ?, ?)
        `,
      )
        .bind(deliveryFailedEventId, record.package_id, failedDetails, now2, exceptionEventLocation ?? resolvedLocation)
        .run();

      // Ensure the cache status reflects terminal stage even if triggers are not available in some environments.
      await c.env.DB.prepare("UPDATE packages SET status = 'delivery_failed' WHERE id = ?")
        .bind(record.package_id)
        .run();
    }

    return c.json({ success: true, event_id: eventId, delivery_failed_event_id: deliveryFailedEventId, action: body.action });
  }
}
