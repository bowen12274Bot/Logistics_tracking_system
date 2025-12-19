import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AuthUser = { id: string; user_class: string; address: string | null };
type VehicleRow = { id: string; driver_user_id: string; vehicle_code: string; home_node_id: string | null; current_node_id: string | null; updated_at: string | null };

async function requireDriver(c: AppContext) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false as const, res: c.json({ error: "Token missing" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
    .bind(token)
    .first<{ user_id: string }>();

  if (!tokenRecord) {
    return { ok: false as const, res: c.json({ error: "Invalid token" }, 401) };
  }

  const user = await c.env.DB.prepare("SELECT id, user_class, address FROM users WHERE id = ?")
    .bind(tokenRecord.user_id)
    .first<AuthUser>();

  if (!user || user.user_class !== "driver") {
    return { ok: false as const, res: c.json({ error: "Forbidden" }, 403) };
  }

  return { ok: true as const, user };
}

async function ensureVehicleForDriver(db: D1Database, driver: AuthUser): Promise<VehicleRow> {
  const existing = await db
    .prepare("SELECT * FROM vehicles WHERE driver_user_id = ? LIMIT 1")
    .bind(driver.id)
    .first<VehicleRow>();
  if (existing) return existing;

  const homeNodeId = (driver.address ?? "").trim();
  if (!homeNodeId) {
    throw new Error("Driver has no home node (users.address is empty)");
  }

  const homeExists = await db.prepare("SELECT 1 AS ok FROM nodes WHERE id = ? LIMIT 1").bind(homeNodeId).first();
  if (!homeExists) {
    throw new Error(`Invalid home node id: ${homeNodeId}`);
  }

  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const hubMatch = homeNodeId.match(/^HUB_(\d+)$/i);
  const hubNo = hubMatch?.[1] ?? null;
  const vehicleCode = hubNo ? `TRUCK_${hubNo}` : `TRUCK_${id.slice(0, 8).toUpperCase()}`;

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

type TaskRow = {
  id: string;
  package_id: string;
  task_type: string;
  from_location: string | null;
  to_location: string | null;
  assigned_driver_id: string | null;
  status: string;
};

async function loadTask(db: D1Database, taskId: string): Promise<TaskRow | null> {
  return db.prepare(
    "SELECT id, package_id, task_type, from_location, to_location, assigned_driver_id, status FROM delivery_tasks WHERE id = ? LIMIT 1",
  )
    .bind(taskId)
    .first<TaskRow>();
}

async function ensureInTransitEvent(
  db: D1Database,
  args: { packageId: string; vehicleCode: string | null; destination: string; nowIso: string },
) {
  const destination = String(args.destination ?? "").trim();
  const vehicleCode = String(args.vehicleCode ?? "").trim();
  if (!destination || !vehicleCode) return;

  const existing = await db.prepare(
    `
    SELECT 1 AS ok
    FROM package_events
    WHERE package_id = ?
      AND LOWER(delivery_status) = 'in_transit'
      AND location = ?
      AND delivery_details LIKE ?
    ORDER BY events_at DESC
    LIMIT 1
    `,
  )
    .bind(args.packageId, vehicleCode, `%${destination}%`)
    .first();
  if (existing) return;

  const earlier = new Date(Math.max(Date.parse(args.nowIso) - 1000, 0)).toISOString();
  const eventId = crypto.randomUUID();
  await db.prepare(
    `
    INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
    VALUES (?, ?, 'in_transit', ?, ?, ?)
    `,
  )
    .bind(eventId, args.packageId, `前往 ${destination}`, earlier, vehicleCode)
    .run();
}

export class DriverTaskPickup extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Pickup/load cargo and start task segment (driver only)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ taskId: z.string().min(1) }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const taskId = String(data.params.taskId).trim();

    const task = await loadTask(c.env.DB, taskId);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.assigned_driver_id !== auth.user.id) return c.json({ error: "Forbidden" }, 403);
    if (task.status !== "pending" && task.status !== "accepted") {
      return c.json({ error: "Task not eligible", status: task.status }, 409);
    }

    let vehicle: VehicleRow;
    try {
      vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }

    const current = String(vehicle.current_node_id ?? "").trim();
    const from = String(task.from_location ?? "").trim();
    if (!from || current !== from) {
      return c.json({ error: "Not at pickup node", current_node_id: current, from_location: from }, 409);
    }

    const now = new Date().toISOString();

    // Backfill "in_transit" if driver arrived without pressing "en-route".
    await ensureInTransitEvent(c.env.DB, {
      packageId: task.package_id,
      vehicleCode: String(vehicle.vehicle_code ?? "").trim() || null,
      destination: from,
      nowIso: now,
    });
    const cargoId = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        "INSERT INTO vehicle_cargo (id, vehicle_id, package_id, loaded_at, unloaded_at) VALUES (?, ?, ?, ?, NULL)",
      )
        .bind(cargoId, vehicle.id, task.package_id, now)
        .run();
    } catch (e: any) {
      return c.json({ error: "Cargo already loaded", detail: String(e?.message ?? e) }, 409);
    }

    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(eventId, task.package_id, "picked_up", "司機已取件上車", now, from)
      .run();

    await c.env.DB.prepare("UPDATE delivery_tasks SET status = 'in_progress', updated_at = ? WHERE id = ?")
      .bind(now, taskId)
      .run();

    return c.json({ success: true, cargo_id: cargoId });
  }
}

export class DriverTaskDropoff extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Dropoff/unload cargo and complete task segment (driver only)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ taskId: z.string().min(1) }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const taskId = String(data.params.taskId).trim();

    const task = await loadTask(c.env.DB, taskId);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.assigned_driver_id !== auth.user.id) return c.json({ error: "Forbidden" }, 403);
    // Require explicit pickup/start before dropoff to avoid "unload without cargo".
    if (task.status !== "in_progress") {
      return c.json({ error: "Task not eligible", status: task.status }, 409);
    }

    let vehicle: VehicleRow;
    try {
      vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }

    const current = String(vehicle.current_node_id ?? "").trim();
    const to = String(task.to_location ?? "").trim();
    if (!to || current !== to) {
      return c.json({ error: "Not at dropoff node", current_node_id: current, to_location: to }, 409);
    }

    const cargo = await c.env.DB.prepare(
      "SELECT id FROM vehicle_cargo WHERE vehicle_id = ? AND package_id = ? AND unloaded_at IS NULL LIMIT 1",
    )
      .bind(vehicle.id, task.package_id)
      .first<{ id: string }>();
    if (!cargo) return c.json({ error: "Cargo not found on this vehicle" }, 409);

    const nextStatus = /^REG_\d+$/i.test(to) || /^HUB_\d+$/i.test(to) ? "warehouse_in" : /^END_/i.test(to) ? "delivered" : "in_transit";
    const nextDetails =
      nextStatus === "warehouse_in" ? "已送達配送站" : nextStatus === "delivered" ? "已送達目的地" : "已到達節點";

    const now = new Date().toISOString();

    // Backfill "in_transit" if completion happens without any prior in-transit record.
    await ensureInTransitEvent(c.env.DB, {
      packageId: task.package_id,
      vehicleCode: String(vehicle.vehicle_code ?? "").trim() || null,
      destination: to,
      nowIso: now,
    });
    await c.env.DB.prepare("UPDATE vehicle_cargo SET unloaded_at = ? WHERE id = ?").bind(now, cargo.id).run();

    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(eventId, task.package_id, nextStatus, nextDetails, now, to)
      .run();

    await c.env.DB.prepare("UPDATE delivery_tasks SET status = 'completed', updated_at = ? WHERE id = ?")
      .bind(now, taskId)
      .run();

    return c.json({ success: true, status: nextStatus });
  }
}
