import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";
import { requireWarehouse, type AuthResult, type AuthUser } from "../utils/authUtils";

type LatestEvent = { delivery_status: string | null; location: string | null; events_at: string | null };
type WarehouseUserWithNode = AuthUser & { address: string };

function authFailed<T>(auth: AuthResult<T>): auth is { ok: false; res: Response } {
  return auth.ok === false;
}

function normalizeNodeId(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

async function requireWarehouseWithNode(c: AppContext): Promise<AuthResult<WarehouseUserWithNode>> {
  const auth = await requireWarehouse(c);
  if (!auth.ok) return auth;

  const nodeId = normalizeNodeId(auth.user.address);
  if (!nodeId) {
    return { ok: false as const, res: c.json({ error: "Warehouse has no node (users.address)" }, 400) };
  }

  return { ok: true as const, user: { ...auth.user, address: nodeId } };
}

// POST /api/warehouse/packages/:packageId/exception - warehouse staff report exception
export class WarehousePackageExceptionCreate extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Warehouse report package exception",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        packageId: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              reason_code: z.string().min(1),
              description: z.string().min(1),
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
    const auth = await requireWarehouseWithNode(c);
    if (authFailed(auth)) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const packageId = String(data.params.packageId).trim();
    const body = data.body as { reason_code: string; description: string };
    const nodeId = auth.user.address!;

    const pkg = await c.env.DB.prepare("SELECT id FROM packages WHERE id = ? LIMIT 1").bind(packageId).first();
    if (!pkg) return c.json({ error: "Package not found" }, 404);

    const terminal = await getTerminalStatus(c.env.DB, packageId);
    if (terminal) return c.json({ error: "Package is terminal", status: terminal }, 409);

    if (await hasActiveException(c.env.DB, packageId)) {
      return c.json({ error: "Package has active exception" }, 409);
    }

    // If still on truck (not unloaded), warehouse must not report it as "at station".
    const cargo = await c.env.DB.prepare(
      "SELECT 1 AS ok FROM vehicle_cargo WHERE package_id = ? AND unloaded_at IS NULL LIMIT 1",
    )
      .bind(packageId)
      .first();
    if (cargo) return c.json({ error: "Package is on truck (unloaded_at is NULL)" }, 409);

    const latest = await c.env.DB.prepare(
      "SELECT delivery_status, location, events_at FROM package_events WHERE package_id = ? ORDER BY events_at DESC LIMIT 1",
    )
      .bind(packageId)
      .first<LatestEvent>();
    const latestLoc = normalizeNodeId(latest?.location);
    const latestStatus = String(latest?.delivery_status ?? "").trim().toLowerCase();
    if (!(latestLoc === nodeId && ["warehouse_in", "warehouse_received", "sorting", "route_decided"].includes(latestStatus))) {
      return c.json(
        {
          error: "Package not at this warehouse",
          warehouse_node_id: nodeId,
          latest_location: latestLoc || null,
          latest_status: latestStatus || null,
        },
        409,
      );
    }

    const now = new Date().toISOString();
    const exceptionId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_exceptions (
        id, package_id, reason_code, description,
        reported_by, reported_role, reported_at,
        handled
      ) VALUES (?, ?, ?, ?, ?, 'warehouse_staff', ?, 0)
      `,
    )
      .bind(exceptionId, packageId, body.reason_code, body.description, auth.user.id, now)
      .run();

    await c.env.DB.prepare(
      `
      UPDATE delivery_tasks
      SET status = 'canceled', updated_at = ?
      WHERE package_id = ?
        AND status IN ('pending','accepted','in_progress')
      `,
    )
      .bind(now, packageId)
      .run();

    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, 'exception', ?, ?, ?)
      `,
    )
      .bind(eventId, packageId, body.description, now, nodeId)
      .run();

    return c.json({ success: true, exception_id: exceptionId, event_id: eventId });
  }
}

// GET /api/warehouse/exceptions - warehouse exception reports list
export class WarehousePackageExceptionList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Warehouse exception reports list",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
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
    const auth = await requireWarehouse(c);
    if (authFailed(auth)) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const limit = data.query.limit;

    const rows = await c.env.DB.prepare(
      `
      SELECT
        pe.id,
        pe.package_id,
        p.tracking_number,
        p.status AS package_status,
        pe.reason_code,
        pe.description,
        pe.reported_at,
        pe.handled,
        pe.handled_at
      FROM package_exceptions pe
      JOIN packages p ON p.id = pe.package_id
      WHERE pe.reported_by = ? AND pe.reported_role = 'warehouse_staff'
      ORDER BY COALESCE(pe.reported_at, '') DESC
      LIMIT ?
      `,
    )
      .bind(auth.user.id, limit)
      .all();

    return c.json({ success: true, exceptions: rows.results ?? [] });
  }
}

