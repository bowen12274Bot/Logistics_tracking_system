import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";
import { requireDriver } from "../utils/authUtils";
import { ensureVehicleForDriver, type VehicleRow } from "../utils/vehicleUtils";

type TaskRow = {
  id: string;
  package_id: string;
  task_type: string;
  from_location: string | null;
  to_location: string | null;
  assigned_driver_id: string | null;
  status: string;
  segment_index: number | null;
  created_at: string | null;
  updated_at: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
};

export class DriverTaskListV2 extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Driver tasks (assigned or handoff at current node)",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        scope: z.enum(["assigned", "handoff"]).optional().default("assigned"),
        status: z.enum(["pending", "accepted", "in_progress", "completed", "canceled"]).optional(),
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
    const { scope, status, limit } = data.query;

    const baseWhere: string[] = [];
    const params: any[] = [];
    if (scope === "assigned") {
      baseWhere.push("t.assigned_driver_id = ?");
      params.push(auth.user.id);

      // Default to active tasks only.
      // If caller specifies status explicitly, honor it instead.
      if (!status) {
        baseWhere.push("t.status IN ('pending','accepted','in_progress')");
      }
    } else {
      let vehicle: VehicleRow;
      try {
        vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
      } catch (e: any) {
        return c.json({ error: String(e?.message ?? e) }, 400);
      }
      const currentNodeId = String(vehicle.current_node_id ?? "").trim();
      if (!currentNodeId) return c.json({ success: true, scope, node_id: null, tasks: [] });

      baseWhere.push("t.from_location = ?");
      params.push(currentNodeId);
      baseWhere.push("(t.from_location LIKE 'HUB_%' OR t.from_location LIKE 'REG_%')");
      baseWhere.push("t.status IN ('pending','accepted')");
      baseWhere.push("(t.assigned_driver_id IS NULL OR t.assigned_driver_id != ?)");
      params.push(auth.user.id);
    }
    if (status) {
      baseWhere.push("t.status = ?");
      params.push(status);
    }

    const whereClause = baseWhere.length ? `WHERE ${baseWhere.join(" AND ")}` : "";

    const rows = await c.env.DB.prepare(
      `
      SELECT
        t.*,
        p.tracking_number,
        p.status AS package_status,
        p.sender_address,
        p.receiver_address,
        p.delivery_time,
        p.payment_type,
        COALESCE(pmt.total_amount, p.declared_value) AS payment_amount,
        pmt.paid_at,
        p.estimated_delivery
      FROM delivery_tasks t
      JOIN packages p ON p.id = t.package_id
      LEFT JOIN payments pmt ON pmt.package_id = p.id
      ${whereClause}
      ORDER BY COALESCE(p.created_at, '') DESC, COALESCE(t.segment_index, 0) ASC, COALESCE(t.created_at, '') DESC
      LIMIT ?
      `,
    )
      .bind(...params, limit)
      .all();

    const tasks = (rows.results || []) as Array<
      TaskRow & {
        tracking_number?: string | null;
        sender_address?: string | null;
        receiver_address?: string | null;
        delivery_time?: string | null;
        payment_type?: string | null;
        payment_amount?: number | null;
        paid_at?: string | null;
        estimated_delivery?: string | null;
      }
    >;

    if (scope === "handoff") {
      let vehicle: VehicleRow | null = null;
      try {
        vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
      } catch {
        vehicle = null;
      }
      return c.json({ success: true, scope, node_id: String(vehicle?.current_node_id ?? "").trim() || null, tasks });
    }

    return c.json({ success: true, scope, tasks });
  }
}

export class DriverTaskAccept extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Handoff: take over a task at current HUB/REG node",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        taskId: z.string().min(1).describe("delivery_tasks.id"),
      }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Not eligible / conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const taskId = String(data.params.taskId).trim();

    let vehicle: VehicleRow;
    try {
      vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }
    const currentNodeId = String(vehicle.current_node_id ?? "").trim();
    if (!currentNodeId) return c.json({ error: "Vehicle has no current node" }, 409);

    const candidate = await c.env.DB.prepare(
      `
      SELECT id, package_id, segment_index, from_location, assigned_driver_id, status
      FROM delivery_tasks
      WHERE id = ?
      LIMIT 1
      `,
    )
      .bind(taskId)
      .first<{
        id: string;
        package_id: string;
        segment_index: number | null;
        from_location: string | null;
        assigned_driver_id: string | null;
        status: string;
      }>();

    if (!candidate) return c.json({ error: "Task not found" }, 404);

    const packageId = String(candidate.package_id);
    const terminal = await getTerminalStatus(c.env.DB, packageId);
    if (terminal) return c.json({ error: "Package is terminal", status: terminal }, 409);
    if (await hasActiveException(c.env.DB, packageId)) {
      return c.json({ error: "Package has active exception" }, 409);
    }

    const from = String(candidate.from_location ?? "").trim();
    if (!from) return c.json({ error: "Task has no from_location" }, 409);
    if (from !== currentNodeId) {
      return c.json({ error: "Not at task start node", from_location: from, current_node_id: currentNodeId }, 409);
    }
    if (!/^HUB_\d+$/i.test(from) && !/^REG_\d+$/i.test(from)) {
      return c.json({ error: "Handoff not allowed from this node", from_location: from }, 409);
    }
    if (candidate.status !== "pending" && candidate.status !== "accepted") {
      return c.json({ error: "Task not eligible for handoff", status: candidate.status }, 409);
    }

    if (candidate.assigned_driver_id === auth.user.id) {
      return c.json({ success: true });
    }

    const now = new Date().toISOString();
    const update = await c.env.DB.prepare(
      `
      UPDATE delivery_tasks
      SET assigned_driver_id = ?, status = 'accepted', updated_at = ?
      WHERE id = ? AND status IN ('pending','accepted')
      `,
    )
      .bind(auth.user.id, now, candidate.id)
      .run();

    if ((update as any)?.meta?.changes === 0) {
      return c.json({ error: "Task not eligible for handoff", reason: "conflict" }, 409);
    }

    return c.json({ success: true });
  }
}

export class DriverTaskComplete extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Complete my assigned task segment (driver only)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        taskId: z.string().min(1).describe("delivery_tasks.id"),
      }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Not eligible" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const taskId = String(data.params.taskId).trim();

    const task = await c.env.DB.prepare(
      "SELECT id, assigned_driver_id, status FROM delivery_tasks WHERE id = ? LIMIT 1",
    )
      .bind(taskId)
      .first<{ id: string; assigned_driver_id: string | null; status: string }>();

    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.assigned_driver_id !== auth.user.id) return c.json({ error: "Forbidden" }, 403);
    if (task.status === "completed" || task.status === "canceled") {
      return c.json({ error: "Task already completed or canceled" }, 409);
    }

    const now = new Date().toISOString();
    const update = await c.env.DB.prepare(
      "UPDATE delivery_tasks SET status = 'completed', updated_at = ? WHERE id = ? AND assigned_driver_id = ?",
    )
      .bind(now, taskId, auth.user.id)
      .run();

    if ((update as any)?.meta?.changes === 0) return c.json({ error: "Not eligible" }, 409);
    return c.json({ success: true });
  }
}





