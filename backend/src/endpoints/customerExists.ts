import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// GET /api/customers/exists - 檢查收件人是否為系統內客戶
export class CustomerExists extends OpenAPIRoute {
  schema = {
    tags: ["Customer"],
    summary: "Check if a customer exists",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        phone: z.string().optional(),
        name: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              exists: z.boolean(),
              user_id: z.string().optional(),
            }),
          },
        },
      },
      "400": { description: "Missing query" },
      "401": { description: "Unauthorized" },
    },
  };

  async handle(c: AppContext) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Token 缺失" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
      .bind(token)
      .first<{ user_id: string }>();

    if (!tokenRecord) {
      return c.json({ error: "Token 無效" }, 401);
    }

    const query = c.req.query();
    const phone = (query.phone ?? "").trim();
    const name = (query.name ?? "").trim();

    if (!phone && !name) {
      return c.json({ success: false, error: "phone or name is required" }, 400);
    }

    let sql = "SELECT id FROM users WHERE user_type = 'customer'";
    const params: any[] = [];

    if (phone && name) {
      sql += " AND (phone_number = ? OR user_name = ?)";
      params.push(phone, name);
    } else if (phone) {
      sql += " AND phone_number = ?";
      params.push(phone);
    } else {
      sql += " AND user_name = ?";
      params.push(name);
    }

    const matched = await c.env.DB.prepare(sql).bind(...params).first<{ id: string }>();

    return c.json({
      success: true,
      exists: !!matched,
      user_id: matched?.id,
    });
  }
}

