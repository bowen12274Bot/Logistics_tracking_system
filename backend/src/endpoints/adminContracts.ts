
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getBillingCycle, createMonthlyBillForCustomer } from "../services/billingService";

// GET /api/admin/contract-applications - 列出合約申請
export class AdminContractList extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "列出合約申請",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
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

    const query = c.req.query();

    let sql = `
      SELECT ca.*, u.user_name as customer_name, u.email as customer_email
      FROM contract_applications ca
      LEFT JOIN users u ON ca.customer_id = u.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (query.status) {
      sql += " AND ca.status = ?";
      params.push(query.status);
    }

    sql += " ORDER BY ca.created_at DESC";

    const result = params.length > 0
      ? await c.env.DB.prepare(sql).bind(...params).all()
      : await c.env.DB.prepare(sql).all();

    return c.json({
      success: true,
      applications: (result.results || []).map((app: any) => ({
        id: app.id,
        customer: {
          id: app.customer_id,
          name: app.customer_name,
          email: app.customer_email,
        },
        company_name: app.company_name,
        tax_id: app.tax_id,
        contact_person: app.contact_person,
        contact_phone: app.contact_phone,
        billing_address: app.billing_address,
        notes: app.notes,
        status: app.status,
        created_at: app.created_at,
      })),
    });
  }
}

// PUT /api/admin/contract-applications/:id - 審核合約申請
export class AdminContractReview extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "審核合約申請",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              status: z.enum(["approved", "rejected"]),
              credit_limit: z.number().optional(),
              review_notes: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "審核完成",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非 admin 角色",
      },
      "404": {
        description: "申請不存在",
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

    const { id } = c.req.param() as { id: string };
    const body = await c.req.json<{
      status: string;
      credit_limit?: number;
      review_notes?: string;
    }>();

    // 查詢申請
    const application = await c.env.DB.prepare(
      "SELECT id, customer_id, status FROM contract_applications WHERE id = ?"
    ).bind(id).first<{ id: string; customer_id: string; status: string }>();

    if (!application) {
      return c.json({ error: "申請不存在" }, 404);
    }

    if (application.status !== "pending") {
      return c.json({ error: "此申請已審核過" }, 400);
    }

    const now = new Date().toISOString();

    // 更新申請狀態
    await c.env.DB.prepare(`
      UPDATE contract_applications
      SET status = ?, reviewed_by = ?, reviewed_at = ?, credit_limit = ?, review_notes = ?
      WHERE id = ?
    `).bind(
      body.status,
      tokenRecord.user_id,
      now,
      body.credit_limit || null,
      body.review_notes || null,
      id
    ).run();



    // 如果核准，更新使用者為合約客戶
    if (body.status === "approved") {
      await c.env.DB.prepare(
        "UPDATE users SET user_class = 'contract_customer', billing_preference = 'monthly' WHERE id = ?"
      ).bind(application.customer_id).run();

      // 為新合約客戶生成當月帳單
      const { start, end } = getBillingCycle(new Date());
      await createMonthlyBillForCustomer(c.env.DB, application.customer_id, start, end);
    }

    return c.json({
      success: true,
      message: body.status === "approved" ? "申請已核准" : "申請已拒絕",
      application_id: id,
      status: body.status,
    });
  }
}
