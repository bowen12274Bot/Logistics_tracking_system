import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// PUT /api/customers/me - 更新客戶資料
export class CustomerUpdate extends OpenAPIRoute {
  schema = {
    tags: ["Customer"],
    summary: "更新客戶資料",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              user_name: z.string().optional(),
              phone_number: z.string().optional(),
              address: z.string().optional(),
              billing_preference: z.enum(["cash", "credit_card", "bank_transfer", "monthly", "third_party_payment"]).optional(),
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
        description: "非合約客戶嘗試設定 monthly",
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

    const body = await c.req.json<{
      user_name?: string;
      phone_number?: string;
      address?: string;
      billing_preference?: string;
    }>();

    // 取得當前使用者資訊
    const user = await c.env.DB.prepare(
      "SELECT user_class FROM users WHERE id = ?"
    ).bind(tokenRecord.user_id).first<{ user_class: string }>();

    if (!user) {
      return c.json({ error: "使用者不存在" }, 401);
    }

    // 檢查 billing_preference = monthly 只有合約客戶可用
    if (body.billing_preference === "monthly" && user.user_class !== "contract_customer") {
      return c.json({ error: "僅合約客戶可使用月結帳單" }, 403);
    }

    // 建立更新語句
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (body.user_name !== undefined) {
      updates.push("user_name = ?");
      values.push(body.user_name);
    }
    if (body.phone_number !== undefined) {
      updates.push("phone_number = ?");
      values.push(body.phone_number);
    }
    if (body.address !== undefined) {
      updates.push("address = ?");
      values.push(body.address);
    }
    if (body.billing_preference !== undefined) {
      updates.push("billing_preference = ?");
      values.push(body.billing_preference);
    }

    if (updates.length === 0) {
      return c.json({ success: true, message: "無更新項目" });
    }

    values.push(tokenRecord.user_id);
    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    return c.json({ success: true, message: "更新成功" });
  }
}
