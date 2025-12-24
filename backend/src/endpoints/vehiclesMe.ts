import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { type AuthUser, requireDriver } from "../utils/authUtils";
import { ensureVehicleForDriver, type VehicleRow } from "../utils/vehicleUtils";





// GET /api/vehicles/me - driver vehicle state (auto-create if missing)
export class VehicleMeGet extends OpenAPIRoute {
  schema = {
    tags: ["Vehicles"],
    summary: "Get my vehicle (driver only)",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              vehicle: z.object({
                id: z.string(),
                vehicle_code: z.string(),
                home_node_id: z.string().nullable(),
                current_node_id: z.string().nullable(),
                updated_at: z.string().nullable(),
              }),
            }),
          },
        },
      },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "400": { description: "Invalid home node" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    try {
      const vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
      return c.json({ success: true, vehicle });
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }
  }
}

// POST /api/vehicles/me/move - move to adjacent node (updates current_node_id)
export class VehicleMeMove extends OpenAPIRoute {
  schema = {
    tags: ["Vehicles"],
    summary: "Move my vehicle to adjacent node (driver only)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              fromNodeId: z.string(),
              toNodeId: z.string(),
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
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const fromNodeId = String(data.body.fromNodeId ?? "").trim();
    const toNodeId = String(data.body.toNodeId ?? "").trim();
    if (!fromNodeId || !toNodeId) return c.json({ error: "Missing fromNodeId/toNodeId" }, 400);
    if (fromNodeId === toNodeId) return c.json({ error: "fromNodeId equals toNodeId" }, 400);

    let vehicle: VehicleRow;
    try {
      vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }

    const current = String(vehicle.current_node_id ?? "").trim();
    if (current !== fromNodeId) {
      return c.json(
        { error: "Vehicle position changed", reason: "stale_from", current_node_id: vehicle.current_node_id },
        409,
      );
    }

    const toExists = await c.env.DB.prepare("SELECT 1 AS ok FROM nodes WHERE id = ? LIMIT 1").bind(toNodeId).first();
    if (!toExists) return c.json({ error: "Invalid toNodeId" }, 400);

    const edgeExists = await c.env.DB.prepare(
      `SELECT 1 AS ok FROM edges
       WHERE (source = ? AND target = ?) OR (source = ? AND target = ?)
       LIMIT 1`,
    )
      .bind(fromNodeId, toNodeId, toNodeId, fromNodeId)
      .first();
    if (!edgeExists) return c.json({ error: "Not adjacent" }, 400);

    const updatedAt = new Date().toISOString();
    const update = await c.env.DB.prepare(
      "UPDATE vehicles SET current_node_id = ?, updated_at = ? WHERE driver_user_id = ? AND current_node_id = ?",
    )
      .bind(toNodeId, updatedAt, auth.user.id, fromNodeId)
      .run();

    if ((update as any)?.meta?.changes === 0) {
      return c.json({ error: "Vehicle position changed", reason: "conflict" }, 409);
    }

    const updated = await c.env.DB.prepare("SELECT * FROM vehicles WHERE driver_user_id = ? LIMIT 1")
      .bind(auth.user.id)
      .first<VehicleRow>();

    // If the truck is carrying packages, mark them as in_transit and append a movement event on the truck.
    // We intentionally use `vehicle_code` as the event location so customer UI can render this as "on the road"
    // (line state) without overwriting node arrival timestamps (point state).
    const cargoRows = await c.env.DB.prepare(
      `
      SELECT vc.package_id AS package_id
      FROM vehicle_cargo vc
      JOIN packages p ON p.id = vc.package_id
      WHERE vc.vehicle_id = ?
        AND vc.unloaded_at IS NULL
        AND COALESCE(p.status, '') NOT IN ('exception','delivered','delivery_failed')
      `,
    )
      .bind(vehicle.id)
      .all<{ package_id: string }>();

    const cargoPackageIds = (cargoRows.results ?? []).map((r) => String((r as any).package_id)).filter(Boolean);
    if (cargoPackageIds.length > 0) {
      const vehicleCode = String(vehicle.vehicle_code ?? "").trim();
      for (const packageId of cargoPackageIds) {
        // Only add in_transit if there is an active segment in progress and this move heads to its destination
        const activeTask = await c.env.DB.prepare(
          `
          SELECT to_location
          FROM delivery_tasks
          WHERE package_id = ?
            AND assigned_driver_id = ?
            AND status = 'in_progress'
          ORDER BY COALESCE(updated_at, created_at, '') DESC
          LIMIT 1
          `,
        )
          .bind(packageId, auth.user.id)
          .first<{ to_location: string | null }>();

        const dest = String(activeTask?.to_location ?? "").trim();
        if (!dest || dest !== toNodeId) continue;

        // Avoid duplicate in_transit events for the same destination
        const existing = await c.env.DB.prepare(
          `
          SELECT 1 AS ok
          FROM package_events
          WHERE package_id = ?
            AND delivery_status = 'in_transit'
            AND delivery_details = ?
            AND location = ?
          ORDER BY events_at DESC
          LIMIT 1
          `,
        )
          .bind(packageId, `前往 ${toNodeId}`, vehicleCode || null)
          .first();
        if (existing) continue;

        const eventId = crypto.randomUUID();
        await c.env.DB.prepare(
          `
          INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
          VALUES (?, ?, 'in_transit', ?, ?, ?)
          `,
        )
          .bind(eventId, packageId, `前往 ${toNodeId}`, updatedAt, vehicleCode || null)
          .run();
      }
    }

    return c.json({ success: true, vehicle: updated ?? null });
  }
}
