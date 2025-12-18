import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AuthUser = { id: string; user_type: string; user_class: string; address: string | null };
type VehicleRow = {
  id: string;
  driver_user_id: string;
  vehicle_code: string;
  home_node_id: string | null;
  current_node_id: string | null;
  updated_at: string | null;
};

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

  const user = await c.env.DB.prepare("SELECT id, user_type, user_class, address FROM users WHERE id = ?")
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
    if (!auth.ok) return auth.res;

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
    if (!auth.ok) return auth.res;

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
      WHERE vc.vehicle_id = ? AND vc.unloaded_at IS NULL
      `,
    )
      .bind(vehicle.id)
      .all<{ package_id: string }>();

    const cargoPackageIds = (cargoRows.results ?? []).map((r) => String((r as any).package_id)).filter(Boolean);
    if (cargoPackageIds.length > 0) {
      const vehicleCode = String(vehicle.vehicle_code ?? "").trim();
      for (const packageId of cargoPackageIds) {
        await c.env.DB.prepare(
          "UPDATE packages SET status = 'in_transit' WHERE id = ? AND COALESCE(status,'') NOT IN ('delivered','exception')",
        )
          .bind(packageId)
          .run();

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
