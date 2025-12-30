import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireDriver } from "../utils/authUtils";

type VehicleRow = {
  id: string;
  driver_user_id: string;
  vehicle_code: string;
  home_node_id: string | null;
  current_node_id: string | null;
  updated_at: string | null;
};

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
  instructions: string | null;
  // Package info
  tracking_number: string | null;
  package_status: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_address: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
  weight: number | null;
  size: string | null;
  delivery_time: string | null;
  payment_type: string | null;
  payment_amount: number | null;
  paid_at: string | null;
  estimated_delivery: string | null;
};

type CargoRow = {
  package_id: string;
  tracking_number: string | null;
  package_status: string | null;
  loaded_at: string | null;
};

// GET /api/driver/dashboard - 司機儀表板聚合 API
export class DriverDashboard extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "司機儀表板聚合資料",
    description: "一次返回所有司機所需的資料，減少 API 調用次數",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "成功",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非駕駛員",
      },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    const driverId = auth.user.id;
    const homeNodeId = (auth.user.address ?? "").trim();

    // 1. 獲取或創建車輛
    let vehicle = await c.env.DB.prepare(
      "SELECT * FROM vehicles WHERE driver_user_id = ? LIMIT 1"
    )
      .bind(driverId)
      .first<VehicleRow>();

    if (!vehicle) {
      // 自動創建車輛
      if (!homeNodeId) {
        return c.json({ error: "Driver has no home node (users.address is empty)" }, 400);
      }

      const homeExists = await c.env.DB.prepare(
        "SELECT 1 AS ok FROM nodes WHERE id = ? LIMIT 1"
      )
        .bind(homeNodeId)
        .first();

      if (!homeExists) {
        return c.json({ error: `Invalid home node id: ${homeNodeId}` }, 400);
      }

      const vehicleId = crypto.randomUUID();
      const now = new Date().toISOString();
      const hubMatch = homeNodeId.match(/^HUB_(\d+)$/i);
      const hubNo = hubMatch?.[1] ?? null;
      const vehicleCode = hubNo ? `TRUCK_${hubNo}` : `TRUCK_${vehicleId.slice(0, 8).toUpperCase()}`;

      await c.env.DB.prepare(
        `INSERT INTO vehicles (id, driver_user_id, vehicle_code, home_node_id, current_node_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(vehicleId, driverId, vehicleCode, homeNodeId, homeNodeId, now)
        .run();

      vehicle = await c.env.DB.prepare(
        "SELECT * FROM vehicles WHERE id = ? LIMIT 1"
      )
        .bind(vehicleId)
        .first<VehicleRow>();
    }

    // 2. 並行獲取所有資料
    const currentNodeId = String(vehicle?.current_node_id ?? "").trim();

    const [assignedResult, handoffResult, cargoResult, exceptionCountResult] = await Promise.all([
      // 已指派的任務
      c.env.DB.prepare(`
        SELECT
          t.*,
          p.tracking_number,
          p.status AS package_status,
          p.sender_name,
          p.sender_phone,
          p.sender_address,
          p.receiver_name,
          p.receiver_phone,
          p.receiver_address,
          p.weight,
          p.size,
          p.delivery_time,
          p.payment_type,
          COALESCE(pmt.total_amount, p.declared_value) AS payment_amount,
          pmt.paid_at,
          p.estimated_delivery
        FROM delivery_tasks t
        JOIN packages p ON p.id = t.package_id
        LEFT JOIN payments pmt ON pmt.package_id = p.id
        WHERE t.assigned_driver_id = ?
          AND t.status IN ('pending', 'accepted', 'in_progress')
        ORDER BY COALESCE(p.created_at, '') DESC, COALESCE(t.segment_index, 0) ASC
        LIMIT 100
      `)
        .bind(driverId)
        .all(),

      // Handoff 任務 (在當前節點可接手的)
      currentNodeId
        ? c.env.DB.prepare(`
            SELECT
              t.*,
              p.tracking_number,
              p.status AS package_status,
              p.sender_name,
              p.sender_phone,
              p.sender_address,
              p.receiver_name,
              p.receiver_phone,
              p.receiver_address,
              p.weight,
              p.size,
              p.delivery_time,
              p.payment_type,
              COALESCE(pmt.total_amount, p.declared_value) AS payment_amount,
              pmt.paid_at,
              p.estimated_delivery
            FROM delivery_tasks t
            JOIN packages p ON p.id = t.package_id
            LEFT JOIN payments pmt ON pmt.package_id = p.id
            WHERE t.from_location = ?
              AND (t.from_location LIKE 'HUB_%' OR t.from_location LIKE 'REG_%')
              AND t.status IN ('pending', 'accepted')
              AND (t.assigned_driver_id IS NULL OR t.assigned_driver_id != ?)
            ORDER BY COALESCE(t.created_at, '') DESC
            LIMIT 50
          `)
            .bind(currentNodeId, driverId)
            .all()
        : Promise.resolve({ results: [] }),

      // 車上貨物
      vehicle
        ? c.env.DB.prepare(`
            SELECT
              vc.package_id,
              p.tracking_number,
              p.status AS package_status,
              vc.loaded_at
            FROM vehicle_cargo vc
            JOIN packages p ON p.id = vc.package_id
            WHERE vc.vehicle_id = ? AND vc.unloaded_at IS NULL
            ORDER BY COALESCE(vc.loaded_at, '') DESC
          `)
            .bind(vehicle.id)
            .all()
        : Promise.resolve({ results: [] }),

      // 異常計數
      c.env.DB.prepare(`
        SELECT COUNT(*) as count
        FROM package_exceptions pe
        WHERE pe.reported_by = ? AND pe.handled = 0
      `)
        .bind(driverId)
        .first<{ count: number }>(),
    ]);

    const assignedTasks = (assignedResult.results || []) as TaskRow[];
    const handoffTasks = (handoffResult.results || []) as TaskRow[];
    const cargo = (cargoResult.results || []) as CargoRow[];
    const exceptionCount = exceptionCountResult?.count ?? 0;

    return c.json({
      success: true,
      vehicle: vehicle
        ? {
            id: vehicle.id,
            vehicle_code: vehicle.vehicle_code,
            home_node_id: vehicle.home_node_id,
            current_node_id: vehicle.current_node_id,
            updated_at: vehicle.updated_at,
          }
        : null,
      assigned_tasks: assignedTasks,
      handoff_tasks: handoffTasks,
      cargo,
      exception_count: exceptionCount,
      synced_at: new Date().toISOString(),
    });
  }
}
