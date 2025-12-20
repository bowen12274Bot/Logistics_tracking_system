import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// GET /api/driver/tasks - 駕駛員工作清單
export class DriverTaskList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "駕駛員工作清單",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        date: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
      }),
    },
    responses: {
      "200": {
        description: "取得成功",
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
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Token 缺失" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const tokenRecord = await c.env.DB.prepare(
      "SELECT user_id FROM tokens WHERE id = ?"
    ).bind(token).first<{ user_id: string }>();

    if (!tokenRecord) {
      return c.json({ error: "Token 無效" }, 401);
    }

    const user = await c.env.DB.prepare(
      "SELECT user_type, user_class FROM users WHERE id = ?"
    ).bind(tokenRecord.user_id).first<{ user_type: string; user_class: string }>();

    if (!user || user.user_class !== "driver") {
      return c.json({ error: "僅駕駛員可使用此功能" }, 403);
    }

    const query = c.req.query();

    // 查詢待配送的包裹（status 為 out_for_delivery 或 in_transit）
    let sql = `
      SELECT p.id, p.tracking_number, p.receiver_name, p.receiver_address, p.receiver_phone,
             p.status, p.estimated_delivery, p.weight, p.special_handling
      FROM packages p
      WHERE p.status IN ('out_for_delivery', 'in_transit', 'picked_up')
    `;

    if (query.status) {
      const statusMap: Record<string, string[]> = {
        pending: ["picked_up", "in_transit"],
        in_progress: ["out_for_delivery"],
        completed: ["delivered"],
      };
      const statuses = statusMap[query.status] || [];
      if (statuses.length > 0) {
        sql = `
          SELECT p.id, p.tracking_number, p.receiver_name, p.receiver_address, p.receiver_phone,
                 p.status, p.estimated_delivery, p.weight, p.special_handling
          FROM packages p
          WHERE p.status IN (${statuses.map(() => "?").join(",")})
        `;
      }
    }

    sql += " ORDER BY p.estimated_delivery ASC LIMIT 50";

    const result = await c.env.DB.prepare(sql).all();

    return c.json({
      success: true,
      tasks: (result.results || []).map((pkg: any) => ({
        package_id: pkg.id,
        tracking_number: pkg.tracking_number,
        receiver: {
          name: pkg.receiver_name,
          phone: pkg.receiver_phone,
          address: pkg.receiver_address,
        },
        status: pkg.status,
        estimated_delivery: pkg.estimated_delivery,
        weight: pkg.weight,
        special_handling: pkg.special_handling ? JSON.parse(pkg.special_handling) : [],
      })),
      total: (result.results || []).length,
    });
  }
}

// POST /api/driver/packages/:packageId/status - 駕駛員更新配送狀態
export class DriverUpdateStatus extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "駕駛員更新配送狀態",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        packageId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              status: z.enum(["picked_up", "in_transit", "out_for_delivery", "delivered"]),
              note: z.string().optional(),
              location: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "更新成功",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非駕駛員",
      },
      "404": {
        description: "包裹不存在",
      },
    },
  };

  async handle(c: AppContext) {
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Token 缺失" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const tokenRecord = await c.env.DB.prepare(
      "SELECT user_id FROM tokens WHERE id = ?"
    ).bind(token).first<{ user_id: string }>();

    if (!tokenRecord) {
      return c.json({ error: "Token 無效" }, 401);
    }

    const user = await c.env.DB.prepare(
      "SELECT user_type, user_class FROM users WHERE id = ?"
    ).bind(tokenRecord.user_id).first<{ user_type: string; user_class: string }>();

    if (!user || user.user_class !== "driver") {
      return c.json({ error: "僅駕駛員可使用此功能" }, 403);
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const { packageId } = data.params as { packageId: string };
    const body = data.body as { status: string; note?: string; location?: string };

    if (body.status === "exception") {
      return c.json({ error: "請使用 /api/driver/packages/:packageId/exception 申報異常" }, 400);
    }

    // 檢查包裹是否存在
    const pkg = await c.env.DB.prepare(
      "SELECT id FROM packages WHERE id = ?"
    ).bind(packageId).first();

    if (!pkg) {
      return c.json({ error: "包裹不存在" }, 404);
    }

    // 新增事件記錄
    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      packageId,
      body.status,
      body.note || null,
      new Date().toISOString(),
      body.location || null
    ).run();

    return c.json({
      success: true,
      message: "狀態已更新",
      event_id: eventId,
    });
  }
}
