import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireAdmin } from "../utils/authUtils";

// GET /api/admin/system/errors - 系統異常查詢
export class AdminSystemErrors extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "查詢系統異常紀錄",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        level: z.enum(["info", "warning", "error", "critical"]).optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        resolved: z.string().optional(),
        limit: z.string().optional(),
        offset: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "查詢成功",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非 admin 角色",
      },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (auth.ok === false) return (auth as any).res;

    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    let sql = "SELECT * FROM system_errors WHERE 1=1";
    const params: (string | number)[] = [];

    if (query.level) {
      sql += " AND level = ?";
      params.push(query.level);
    }

    if (query.date_from) {
      sql += " AND occurred_at >= ?";
      params.push(query.date_from);
    }

    if (query.date_to) {
      sql += " AND occurred_at <= ?";
      params.push(query.date_to);
    }

    if (query.resolved !== undefined) {
      sql += " AND resolved = ?";
      params.push(query.resolved === "true" ? 1 : 0);
    }

    // 計算總數
    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
    const countResult = params.length > 0
      ? await c.env.DB.prepare(countSql).bind(...params).first<{ total: number }>()
      : await c.env.DB.prepare(countSql).first<{ total: number }>();
    const total = countResult?.total || 0;

    sql += " ORDER BY occurred_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      errors: (result.results || []).map((err: any) => ({
        id: err.id,
        level: err.level,
        code: err.code,
        message: err.message,
        details: err.details,
        occurred_at: err.occurred_at,
        resolved: err.resolved === 1,
      })),
      total,
      limit,
      offset,
    });
  }
}
