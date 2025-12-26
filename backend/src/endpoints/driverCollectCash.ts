import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireDriver } from "../utils/authUtils";
import { ensureVehicleForDriver } from "../utils/vehicleUtils";

async function hasEvent(db: D1Database, packageId: string, status: string) {
  const row = await db
    .prepare("SELECT 1 AS ok FROM package_events WHERE package_id = ? AND LOWER(delivery_status) = LOWER(?) LIMIT 1")
    .bind(packageId, status)
    .first();
  return !!row;
}

export class DriverCollectCash extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Collect cash payment on-site (driver only)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ packageId: z.string().min(1) }),
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
    const packageId = String(data.params.packageId).trim();

    const vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    const currentNodeId = String(vehicle.current_node_id ?? "").trim();
    if (!currentNodeId) return c.json({ error: "Vehicle has no current node" }, 409);

    const row = await c.env.DB
      .prepare(
        `
        SELECT
          p.payment_type AS payment_type,
          p.sender_address AS sender_address,
          p.receiver_address AS receiver_address,
          pay.id AS payment_id,
          pay.payer_user_id AS payer_user_id,
          pay.paid_at AS paid_at
        FROM packages p
        JOIN payments pay ON pay.package_id = p.id
        WHERE p.id = ?
        LIMIT 1
        `,
      )
      .bind(packageId)
      .first<any>();

    if (!row) return c.json({ error: "Package not found" }, 404);
    if (row.paid_at) return c.json({ error: "Already paid" }, 409);

    const paymentType = String(row.payment_type ?? "").trim().toLowerCase();
    const senderAddress = String(row.sender_address ?? "").trim().toUpperCase();
    const receiverAddress = String(row.receiver_address ?? "").trim().toUpperCase();

    // Require driver to be on an active task segment at this node (prevents collecting at arbitrary nodes).
    const activeTask = await c.env.DB
      .prepare(
        `
        SELECT id, task_type, from_location, to_location, status
        FROM delivery_tasks
        WHERE package_id = ? AND assigned_driver_id = ? AND status IN ('pending','accepted','in_progress')
        ORDER BY COALESCE(segment_index, 0) ASC, COALESCE(created_at, '') ASC
        `,
      )
      .bind(packageId, auth.user.id)
      .first<{ id: string; task_type: string; from_location: string | null; to_location: string | null; status: string }>();
    if (!activeTask) return c.json({ error: "No active task for this package" }, 409);

    const from = String(activeTask.from_location ?? "").trim().toUpperCase();
    const to = String(activeTask.to_location ?? "").trim().toUpperCase();

    if (paymentType === "prepaid") {
      if (activeTask.task_type !== "pickup" || from !== currentNodeId.toUpperCase()) {
        return c.json({ error: "Cash collection for prepaid must happen at pickup node" }, 409);
      }

      const isHome = senderAddress.startsWith("END_HOME_");
      if (isHome && !(await hasEvent(c.env.DB, packageId, "arrived_pickup"))) {
        return c.json({ error: "Cash prepaid at home requires arrived_pickup first" }, 409);
      }
    } else if (paymentType === "cod") {
      const isStore = receiverAddress.startsWith("END_STORE_");
      if (isStore) {
        return c.json({ error: "Store COD is paid by receiver after dropoff; driver should not collect cash here" }, 409);
      }

      if (activeTask.task_type !== "deliver" || to !== currentNodeId.toUpperCase()) {
        return c.json({ error: "Cash collection for COD must happen at delivery node" }, 409);
      }
      if (!(await hasEvent(c.env.DB, packageId, "arrived_delivery"))) {
        return c.json({ error: "COD at home requires arrived_delivery first" }, 409);
      }
    } else {
      return c.json({ error: "Unsupported payment_type" }, 409);
    }

    const now = new Date().toISOString();
    await c.env.DB
      .prepare("UPDATE payments SET paid_at = ?, payment_method = 'cash', collected_by = ? WHERE id = ? AND paid_at IS NULL")
      .bind(now, auth.user.id, row.payment_id)
      .run();

    const eventId = crypto.randomUUID();
    const status = paymentType === "cod" ? "payment_collected_cod" : "payment_collected_prepaid";
    const details = paymentType === "cod" ? "COD cash collected by driver" : "Prepaid cash collected by driver";
    await c.env.DB
      .prepare(
        "INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(eventId, packageId, status, details, now, currentNodeId)
      .run();

    return c.json({ success: true, paid_at: now, payment_method: "cash" });
  }
}

