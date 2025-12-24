import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";
import { requireDriver, type AuthUser } from "../utils/authUtils";

type VehicleRow = {
  id: string;
  driver_user_id: string;
  vehicle_code: string;
  home_node_id: string | null;
  current_node_id: string | null;
  updated_at: string | null;
};

async function ensureVehicleForDriver(db: D1Database, driver: AuthUser): Promise<VehicleRow> {
  const existing = await db
    .prepare("SELECT * FROM vehicles WHERE driver_user_id = ? LIMIT 1")
    .bind(driver.id)
    .first<VehicleRow>();
  if (existing) return existing;

  const homeNodeId = String(driver.address ?? "").trim();
  if (!homeNodeId) {
    throw new Error("Driver has no home node (users.address is empty)");
  }

  const homeExists = await db.prepare("SELECT 1 AS ok FROM nodes WHERE id = ? LIMIT 1").bind(homeNodeId).first();
  if (!homeExists) {
    throw new Error(`Invalid home node id: ${homeNodeId}`);
  }

  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const hubMatch = homeNodeId.match(/^HUB_(\\d+)$/i);
  const hubNo = hubMatch?.[1] ?? null;
  let vehicleCode = hubNo ? `TRUCK_${hubNo}` : `TRUCK_${id.slice(0, 8).toUpperCase()}`;

  const existingCode = await db
    .prepare("SELECT 1 AS ok FROM vehicles WHERE vehicle_code = ? LIMIT 1")
    .bind(vehicleCode)
    .first();
  if (existingCode) {
    const suffix = driver.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || id.slice(0, 4).toUpperCase();
    vehicleCode = `${vehicleCode}_${suffix}`;
  }

  await db
    .prepare(
      `INSERT INTO vehicles (id, driver_user_id, vehicle_code, home_node_id, current_node_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, driver.id, vehicleCode, homeNodeId, homeNodeId, updatedAt)
    .run();

  const created = await db.prepare("SELECT * FROM vehicles WHERE id = ? LIMIT 1").bind(id).first<VehicleRow>();
  if (!created) throw new Error("Vehicle creation failed");
  return created;
}


// POST /api/driver/packages/:packageId/exception - driver report exception (creates package_exceptions + event)
export class DriverPackageExceptionCreate extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Driver report package exception",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        packageId: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              reason_code: z.string().min(1).optional(),
              description: z.string().min(1),
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
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const packageId = String(data.params.packageId).trim();
    const body = data.body as { reason_code?: string; description: string; location?: string };
    const reasonCode = String(body.reason_code ?? "").trim() || null;

    const pkg = await c.env.DB.prepare("SELECT id FROM packages WHERE id = ? LIMIT 1").bind(packageId).first();
    if (!pkg) return c.json({ error: "Package not found" }, 404);

    const terminal = await getTerminalStatus(c.env.DB, packageId);
    if (terminal) return c.json({ error: "Package is terminal", status: terminal }, 409);

    if (await hasActiveException(c.env.DB, packageId)) {
      return c.json({ error: "Package has active exception" }, 409);
    }

    const now = new Date().toISOString();
    const exceptionId = crypto.randomUUID();

    // Location authority:
    // - If the package is currently loaded on a truck, lock exception.location to that TRUCK code.
    // - Otherwise, lock to the driver's current node (and require it matches a task location for this package).
    const activeCargo = await c.env.DB.prepare(
      `
      SELECT v.vehicle_code, v.driver_user_id, v.current_node_id
      FROM vehicle_cargo vc
      JOIN vehicles v ON v.id = vc.vehicle_id
      WHERE vc.package_id = ?
        AND vc.unloaded_at IS NULL
      ORDER BY vc.loaded_at DESC
      LIMIT 1
      `,
    )
      .bind(packageId)
      .first<{ vehicle_code: string; driver_user_id: string; current_node_id: string | null }>();

    let driverVehicle = await c.env.DB.prepare(
      "SELECT vehicle_code, current_node_id FROM vehicles WHERE driver_user_id = ? LIMIT 1",
    )
      .bind(auth.user.id)
      .first<{ vehicle_code: string | null; current_node_id: string | null }>();

    if (!driverVehicle) {
      try {
        const created = await ensureVehicleForDriver(c.env.DB, auth.user);
        driverVehicle = { vehicle_code: created.vehicle_code, current_node_id: created.current_node_id };
      } catch (e: any) {
        return c.json({ error: String(e?.message ?? e) }, 400);
      }
    }

    const currentNodeId = String(driverVehicle?.current_node_id ?? "").trim().toUpperCase() || null;
    const myTruckCode = String(driverVehicle?.vehicle_code ?? "").trim().toUpperCase() || null;

    const requestedLocation = String(body.location ?? "").trim().toUpperCase() || null;

    const task = await c.env.DB.prepare(
      `
      SELECT from_location, to_location, status
      FROM delivery_tasks
      WHERE package_id = ?
        AND assigned_driver_id = ?
        AND status IN ('pending','accepted','in_progress')
      ORDER BY COALESCE(updated_at, created_at, '') DESC
      LIMIT 1
      `,
    )
      .bind(packageId, auth.user.id)
      .first<{ from_location: string | null; to_location: string | null; status: string }>();

    // Backwards compatible: allow exception reports even if the driver has no active task for this package.
    // (Some flows/tests report "lost/damaged" without ensuring task assignment.)
    const relatedNodes = new Set<string>();
    if (task) {
      const from = String(task.from_location ?? "").trim().toUpperCase();
      const to = String(task.to_location ?? "").trim().toUpperCase();
      for (const n of [from, to]) {
        if (n) relatedNodes.add(n);
      }
    }
    let location: string | null = requestedLocation;
    if (activeCargo) {
      if (String(activeCargo.driver_user_id) !== auth.user.id) {
        return c.json({ error: "Package cargo is not on your vehicle" }, 403);
      }

      const cargoTruck = String(activeCargo.vehicle_code ?? "").trim().toUpperCase();
      const cargoNodeId = String(activeCargo.current_node_id ?? "").trim().toUpperCase() || currentNodeId;

      if (!requestedLocation) {
        // Default to "on truck" when cargo is loaded.
        location = cargoTruck || myTruckCode;
      } else if (/^TRUCK_/i.test(requestedLocation)) {
        if (requestedLocation !== cargoTruck) {
          return c.json({ error: "Invalid location: must be your cargo truck code", expected: cargoTruck }, 400);
        }
        location = cargoTruck;
      } else {
        // Node mode is allowed while cargo is still on truck (e.g. arrived but not unloaded, or no_answer at END_*),
        // but it must be the driver's current node and must relate to the active task.
        if (!cargoNodeId) return c.json({ error: "Driver vehicle has no current node" }, 409);
        if (requestedLocation !== cargoNodeId) {
          return c.json({ error: "Invalid location: must match current node", current: cargoNodeId }, 400);
        }
        if (relatedNodes.size > 0 && !relatedNodes.has(requestedLocation)) {
          return c.json({ error: "Invalid location: node not related to task", location: requestedLocation, related: [...relatedNodes] }, 409);
        }
        location = requestedLocation;
      }
    } else {
      // No cargo: driver must be at a relevant node for this package task, and location must not be arbitrary.
      // Backwards compatible: allow reporting a TRUCK_* location even if cargo isn't currently loaded.
      if (!currentNodeId && !myTruckCode) return c.json({ error: "Driver vehicle has no current node" }, 409);

      if (currentNodeId && relatedNodes.size > 0 && !relatedNodes.has(currentNodeId)) {
        return c.json({ error: "Driver is not at a related node for this task", current: currentNodeId, related: [...relatedNodes] }, 409);
      }

      if (requestedLocation) {
        if (/^TRUCK_/i.test(requestedLocation)) {
          if (!myTruckCode) return c.json({ error: "Driver vehicle has no truck code" }, 409);
          if (requestedLocation !== myTruckCode) {
            return c.json({ error: "Invalid location: must be your truck code", expected: myTruckCode }, 400);
          }
          location = myTruckCode;
        } else {
          if (!currentNodeId) return c.json({ error: "Driver vehicle has no current node" }, 409);
          if (requestedLocation !== currentNodeId) {
            return c.json({ error: "Invalid location: must match current node", current: currentNodeId }, 400);
          }
          location = currentNodeId;
        }
      } else {
        location = currentNodeId || myTruckCode;
      }
    }

    await c.env.DB.prepare(
      `
      INSERT INTO package_exceptions (
        id, package_id, reason_code, description,
        reported_by, reported_role, reported_at,
        handled
      ) VALUES (?, ?, ?, ?, ?, 'driver', ?, 0)
      `,
    )
      .bind(
        exceptionId,
        packageId,
        reasonCode,
        body.description,
        auth.user.id,
        now,
      )
      .run();

    // Remove this package from driver task lists immediately after exception is reported.
    // We cancel all active segments for this package (regardless of assignee) so it won't keep showing up.
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
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(eventId, packageId, "exception", body.description, now, location)
      .run();

    return c.json({ success: true, exception_id: exceptionId });
  }
}

// GET /api/driver/exceptions - driver exception reports list
export class DriverPackageExceptionList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Driver exception reports list",
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
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

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
      WHERE pe.reported_by = ? AND pe.reported_role = 'driver'
      ORDER BY COALESCE(pe.reported_at, '') DESC
      LIMIT ?
      `,
    )
      .bind(auth.user.id, limit)
      .all();

    return c.json({ success: true, exceptions: rows.results ?? [] });
  }
}
