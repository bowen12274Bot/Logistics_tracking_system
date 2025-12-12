import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// POST /api/customers/contract-application - 申請合約客戶
export class ContractApplication extends OpenAPIRoute {
  schema = {
    tags: ["Customer"],
    summary: "申請成為合約客戶",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              company_name: z.string(),
              tax_id: z.string(),
              contact_person: z.string(),
              contact_phone: z.string(),
              billing_address: z.string(),
              notes: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "申請成功",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              application_id: z.string(),
              status: z.string(),
              message: z.string(),
            }),
          },
        },
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "已是合約客戶或有待審核申請",
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

    // 取得使用者資訊
    const user = await c.env.DB.prepare(
      "SELECT user_type, user_class FROM users WHERE id = ?"
    ).bind(tokenRecord.user_id).first<{ user_type: string; user_class: string }>();

    if (!user) {
      return c.json({ error: "使用者不存在" }, 401);
    }

    // 檢查是否為客戶角色
    if (user.user_type !== "customer") {
      return c.json({ error: "僅客戶可申請合約" }, 403);
    }

    // 檢查是否已是合約客戶
    if (user.user_class === "contract_customer") {
      return c.json({ error: "您已是合約客戶" }, 403);
    }

    // 檢查是否有待審核申請
    const pendingApp = await c.env.DB.prepare(
      "SELECT id FROM contract_applications WHERE customer_id = ? AND status = 'pending'"
    ).bind(tokenRecord.user_id).first();

    if (pendingApp) {
      return c.json({ error: "您已有待審核的申請" }, 403);
    }

    const body = await c.req.json<{
      company_name: string;
      tax_id: string;
      contact_person: string;
      contact_phone: string;
      billing_address: string;
      notes?: string;
    }>();

    // 驗證必填欄位
    if (!body.company_name || !body.tax_id || !body.contact_person || 
        !body.contact_phone || !body.billing_address) {
      return c.json({ error: "缺少必填欄位" }, 400);
    }

    const applicationId = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO contract_applications 
      (id, customer_id, company_name, tax_id, contact_person, contact_phone, billing_address, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      applicationId,
      tokenRecord.user_id,
      body.company_name,
      body.tax_id,
      body.contact_person,
      body.contact_phone,
      body.billing_address,
      body.notes ?? null
    ).run();

    return c.json({
      success: true,
      application_id: applicationId,
      status: "pending",
      message: "申請已送出，等待審核",
    });
  }
}
