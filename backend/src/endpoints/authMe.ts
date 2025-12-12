import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// GET /api/auth/me - 取得當前使用者資訊
export class AuthMe extends OpenAPIRoute {
  schema = {
    tags: ["Auth"],
    summary: "取得當前使用者資訊",
    security: [{ bearerAuth: [] }],
    responses: {
      "200": {
        description: "成功",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              user: z.object({
                id: z.string(),
                user_name: z.string(),
                phone_number: z.string().nullable(),
                address: z.string().nullable(),
                email: z.string(),
                user_type: z.string(),
                user_class: z.string(),
                billing_preference: z.string().nullable(),
              }),
            }),
          },
        },
      },
      "401": {
        description: "未認證",
      },
    },
  };

  async handle(c: AppContext) {
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Token 缺失" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    // 查詢 token 對應的使用者
    const tokenRecord = await c.env.DB.prepare(
      "SELECT user_id FROM tokens WHERE id = ?"
    ).bind(token).first<{ user_id: string }>();

    if (!tokenRecord) {
      return c.json({ error: "Token 無效" }, 401);
    }

    const user = await c.env.DB.prepare(
      "SELECT id, user_name, phone_number, address, email, user_type, user_class, billing_preference FROM users WHERE id = ?"
    ).bind(tokenRecord.user_id).first();

    if (!user) {
      return c.json({ error: "使用者不存在" }, 401);
    }

    return c.json({ success: true, user });
  }
}
