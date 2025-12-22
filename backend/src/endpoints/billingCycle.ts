import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { settleBillingCycle } from "../services/billingService";

// POST /api/admin/billing/settle - 月結算
export class BillingSettle extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "執行月結算 (Settlement)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              cycle_year_month: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "結算成功",
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

    if (!user || user.user_class !== "admin") {
      return c.json({ error: "僅 admin 可使用此功能" }, 403);
    }

    const body = await c.req.json<{ cycle_year_month: string }>();
    const [yearStr, monthStr] = body.cycle_year_month.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    try {
      const result = await settleBillingCycle(c.env.DB, year, month);
      return c.json({ success: true, result });
    } catch (e: any) {
      return c.json({ error: "結算失敗", detail: String(e?.message ?? e) }, 500);
    }
  }
}
