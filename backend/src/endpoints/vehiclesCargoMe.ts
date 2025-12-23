import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

import { requireDriver, type AuthUser } from "../utils/authUtils";

type VehicleRow = { id: string; driver_user_id: string; vehicle_code: string; home_node_id: string | null; current_node_id: string | null; updated_at: string | null };


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

export class VehicleMeCargoList extends OpenAPIRoute {
  schema = {
    tags: ["Vehicles"],
    summary: "List my vehicle cargo (driver only)",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    let vehicle: VehicleRow;
    try {
      vehicle = await ensureVehicleForDriver(c.env.DB, auth.user);
    } catch (e: any) {
      return c.json({ error: String(e?.message ?? e) }, 400);
    }

    const rows = await c.env.DB.prepare(
      `
      SELECT
        vc.package_id,
        p.tracking_number,
        p.status AS package_status,
        vc.loaded_at
      FROM vehicle_cargo vc
      JOIN packages p ON p.id = vc.package_id
      WHERE vc.vehicle_id = ? AND vc.unloaded_at IS NULL
      ORDER BY COALESCE(vc.loaded_at, '') DESC
      `,
    )
      .bind(vehicle.id)
      .all();

    return c.json({ success: true, vehicle_id: vehicle.id, cargo: rows.results ?? [] });
  }
}
