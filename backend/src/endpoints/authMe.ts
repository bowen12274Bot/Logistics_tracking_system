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

    // 優化：合併 token 和 user 查詢為單一 JOIN 查詢
    const user = await c.env.DB.prepare(`
      SELECT u.id, u.user_name, u.phone_number, u.address, u.email, 
             u.user_type, u.user_class, u.billing_preference 
      FROM tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
      LIMIT 1
    `).bind(token).first();

    if (!user) {
      return c.json({ error: "Token 無效或使用者不存在" }, 401);
    }

    return c.json({ success: true, user });
  }
}
