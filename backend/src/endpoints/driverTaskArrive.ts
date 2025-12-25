import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";
import { requireDriver } from "../utils/authUtils";
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

async function insertArrivedEventIfMissing(db: D1Database, packageId: string, status: "arrived_pickup" | "arrived_delivery", location: string) {
  const existing = await db.prepare(
    `
    SELECT 1 AS ok
    FROM package_events
    WHERE package_id = ?
      AND LOWER(delivery_status) = LOWER(?)
      AND location = ?
    ORDER BY events_at DESC
    LIMIT 1
    `,
  )
    .bind(packageId, status, location)
    .first();
  if (existing) return;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, packageId, status, null, now, location)
    .run();
}

// POST /api/driver/tasks/:taskId/arrive - mark that driver arrived at pickup/delivery location (for cash payment window)
export class DriverTaskArrive extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Mark arrival at pickup/delivery node (driver only)",
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

    const packageId = String(task.package_id);
    const terminal = await getTerminalStatus(c.env.DB, packageId);
    if (terminal) return c.json({ error: "Package is terminal", status: terminal }, 409);
    if (await hasActiveException(c.env.DB, packageId)) {
      return c.json({ error: "Package has active exception" }, 409);
    }

    const taskType = String(task.task_type ?? "").trim().toLowerCase();
    const from = String(task.from_location ?? "").trim();
    const to = String(task.to_location ?? "").trim();
    const current = String(vehicle.current_node_id ?? "").trim();

    if (taskType === "pickup") {
      if (!from) return c.json({ error: "Task has no from_location" }, 409);
      if (current !== from) return c.json({ error: "Not at pickup node", current_node_id: current, from_location: from }, 409);
      await insertArrivedEventIfMissing(c.env.DB, packageId, "arrived_pickup", from);
      return c.json({ success: true, status: "arrived_pickup", location: from });
    }

    // Default: delivery/transfer segments use to_location as arrival node.
    if (!to) return c.json({ error: "Task has no to_location" }, 409);
    if (current !== to) return c.json({ error: "Not at delivery node", current_node_id: current, to_location: to }, 409);
    await insertArrivedEventIfMissing(c.env.DB, packageId, "arrived_delivery", to);
    return c.json({ success: true, status: "arrived_delivery", location: to });
  }
}

