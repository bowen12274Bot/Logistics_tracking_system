import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AuthUser = { id: string; user_class: string; address: string | null };
type VehicleRow = { id: string; driver_user_id: string; current_node_id: string | null };

async function requireDriver(c: AppContext) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false as const, res: c.json({ error: "Token missing" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
    .bind(token)
    .first<{ user_id: string }>();

  if (!tokenRecord) return { ok: false as const, res: c.json({ error: "Invalid token" }, 401) };

  const user = await c.env.DB.prepare("SELECT id, user_class, address FROM users WHERE id = ?")
    .bind(tokenRecord.user_id)
    .first<AuthUser>();

  if (!user || user.user_class !== "driver") {
    return { ok: false as const, res: c.json({ error: "Forbidden" }, 403) };
  }

  return { ok: true as const, user };
}

async function ensureVehicleForDriver(db: D1Database, driver: AuthUser): Promise<VehicleRow> {
  const vehicle = await db.prepare("SELECT id, driver_user_id, current_node_id FROM vehicles WHERE driver_user_id = ? LIMIT 1")
    .bind(driver.id)
    .first<VehicleRow>();
  if (vehicle) return vehicle;

  // Fallback: create via same logic as /api/vehicles/me (only when driver has a valid home node).
  const homeNodeId = (driver.address ?? "").trim();
  if (!homeNodeId) throw new Error("Driver has no home node (users.address is empty)");

  const homeExists = await db.prepare("SELECT 1 AS ok FROM nodes WHERE id = ? LIMIT 1").bind(homeNodeId).first();
  if (!homeExists) throw new Error(`Invalid home node id: ${homeNodeId}`);

  const id = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const hubMatch = homeNodeId.match(/^HUB_(\d+)$/i);
  const hubNo = hubMatch?.[1] ?? null;
  const vehicleCode = hubNo ? `TRUCK_${hubNo}` : `TRUCK_${id.slice(0, 8).toUpperCase()}`;

  await db.prepare(
    `INSERT INTO vehicles (id, driver_user_id, vehicle_code, home_node_id, current_node_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, driver.id, vehicleCode, homeNodeId, homeNodeId, updatedAt)
    .run();

  const created = await db.prepare("SELECT id, driver_user_id, current_node_id FROM vehicles WHERE id = ? LIMIT 1")
    .bind(id)
    .first<VehicleRow>();
  if (!created) throw new Error("Vehicle creation failed");
  return created;
}

type TaskRow = {
  id: string;
  package_id: string;
  task_type: string | null;
  from_location: string | null;
  to_location: string | null;
  assigned_driver_id: string | null;
  status: string;
};

export class DriverTaskEnRoute extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Mark my in-progress task segment as in_transit (driver only)",
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

    const task = await c.env.DB.prepare(
      "SELECT id, package_id, task_type, from_location, to_location, assigned_driver_id, status FROM delivery_tasks WHERE id = ? LIMIT 1",
    )
      .bind(taskId)
      .first<TaskRow>();
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.assigned_driver_id !== auth.user.id) return c.json({ error: "Forbidden" }, 403);
    const status = String(task.status ?? "").trim();
    if (!["pending", "accepted", "in_progress"].includes(status)) {
      return c.json({ error: "Task not eligible", status }, 409);
    }

    let vehicle: VehicleRow;
    try {
      vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }

    // For a picked-up (in_progress) segment we require cargo on the truck.
    if (status === "in_progress") {
      const cargo = await c.env.DB.prepare(
        "SELECT 1 AS ok FROM vehicle_cargo WHERE vehicle_id = ? AND package_id = ? AND unloaded_at IS NULL LIMIT 1",
      )
        .bind(vehicle.id, String(task.package_id))
        .first();
      if (!cargo) return c.json({ error: "Cargo not found on this vehicle" }, 409);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "UPDATE packages SET status = 'in_transit' WHERE id = ? AND COALESCE(status,'') NOT IN ('delivered','exception')",
    )
      .bind(String(task.package_id))
      .run();

    const vehicleCodeRow = await c.env.DB.prepare("SELECT vehicle_code FROM vehicles WHERE id = ? LIMIT 1")
      .bind(vehicle.id)
      .first<{ vehicle_code: string }>();
    const vehicleCode = String(vehicleCodeRow?.vehicle_code ?? "").trim() || null;

    const destination =
      status === "in_progress" ? String(task.to_location ?? "").trim() : String(task.from_location ?? "").trim();
    const details = destination ? `前往 ${destination}` : "前往目的地";

    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, 'in_transit', ?, ?, ?)
      `,
    )
      .bind(eventId, String(task.package_id), details, now, vehicleCode)
      .run();

    return c.json({ success: true, status: "in_transit", location: vehicleCode });
  }
}
