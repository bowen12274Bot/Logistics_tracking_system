import type { AuthUser } from "./authUtils";

export type VehicleRow = {
  id: string;
  driver_user_id: string;
  vehicle_code: string;
  home_node_id: string | null;
  current_node_id: string | null;
  updated_at: string | null;
};

export async function ensureVehicleForDriver(db: D1Database, driver: AuthUser): Promise<VehicleRow> {
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
