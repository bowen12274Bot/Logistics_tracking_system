import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// GET /api/tracking/search - 進階搜尋（員工用）
export class TrackingSearch extends OpenAPIRoute {
  schema = {
    tags: ["Tracking"],
    summary: "進階追蹤搜尋（員工用）",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        tracking_number: z.string().optional(),
        customer_id: z.string().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        location_id: z.string().optional(),
        status: z.string().optional(),
        exception_only: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "搜尋成功",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "權限不足",
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

    // 檢查權限
    const user = await c.env.DB.prepare(
      "SELECT user_type, user_class FROM users WHERE id = ?"
    ).bind(tokenRecord.user_id).first<{ user_type: string; user_class: string }>();

    if (!user) {
      return c.json({ error: "使用者不存在" }, 401);
    }

    // 只有 customer_service, warehouse, admin 可使用
    const allowedRoles = ["customer_service", "warehouse_staff", "admin"];
    if (user.user_type !== "employee" || !allowedRoles.includes(user.user_class)) {
      return c.json({ error: "權限不足" }, 403);
    }

    const query = c.req.query();

    // 建立查詢條件
    let sql = `
      SELECT p.id, p.tracking_number, p.status, p.customer_id, p.created_at,
             p.sender_name, p.receiver_name, p.estimated_delivery
      FROM packages p
      WHERE 1=1
    `;
    const params: string[] = [];

    if (query.tracking_number) {
      sql += " AND p.tracking_number LIKE ?";
      params.push(`%${query.tracking_number}%`);
    }

    if (query.customer_id) {
      sql += " AND p.customer_id = ?";
      params.push(query.customer_id);
    }

    if (query.date_from) {
      sql += " AND p.created_at >= ?";
      params.push(query.date_from);
    }

    if (query.date_to) {
      sql += " AND p.created_at <= ?";
      params.push(query.date_to);
    }

    if (query.status) {
      sql += " AND p.status = ?";
      params.push(query.status);
    }

    if (query.exception_only === "true") {
      sql += " AND p.status = 'exception'";
    }

    sql += " ORDER BY p.created_at DESC LIMIT 100";

    const stmt = c.env.DB.prepare(sql);
    const result = params.length > 0 
      ? await stmt.bind(...params).all()
      : await stmt.all();

    // 如果有 location_id 篩選，需要額外過濾
    let packages = result.results || [];
    
    if (query.location_id) {
      // 查詢最新事件的 location
      const packageIds = packages.map((p: any) => p.id);
      if (packageIds.length > 0) {
        const locationFilter = query.location_id;
        const filteredPackages = [];
        
        for (const pkg of packages) {
          const latestEvent = await c.env.DB.prepare(
            "SELECT location FROM package_events WHERE package_id = ? ORDER BY events_at DESC LIMIT 1"
          ).bind((pkg as any).id).first<{ location: string }>();
          
          if (latestEvent && latestEvent.location === locationFilter) {
            filteredPackages.push(pkg);
          }
        }
        packages = filteredPackages;
      }
    }

    return c.json({
      success: true,
      packages,
      total: packages.length,
    });
  }
}
