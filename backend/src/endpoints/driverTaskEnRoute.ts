import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";
import { requireDriver, type AuthUser } from "../utils/authUtils";

import { ensureVehicleForDriver, type VehicleRow } from "../utils/vehicleUtils";

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
    if (!auth.ok) return (auth as any).res;

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
    const packageId = String(task.package_id);
    const terminal = await getTerminalStatus(c.env.DB, packageId);
    if (terminal) return c.json({ error: "Package is terminal", status: terminal }, 409);
    if (await hasActiveException(c.env.DB, packageId)) {
      return c.json({ error: "Package has active exception" }, 409);
    }

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
