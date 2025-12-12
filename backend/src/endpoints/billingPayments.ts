import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// POST /api/billing/payments - 付款
export class BillingPaymentCreate extends OpenAPIRoute {
  schema = {
    tags: ["Billing"],
    summary: "為帳單付款",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              bill_id: z.string(),
              payment_method: z.enum(["credit_card", "bank_transfer"]),
              amount: z.number(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "付款成功",
      },
      "400": {
        description: "金額不符或帳單已付款",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "無權付款此帳單",
      },
      "404": {
        description: "帳單不存在",
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
      bill_id: string;
      payment_method: string;
      amount: number;
    }>();

    // 查詢帳單
    const bill = await c.env.DB.prepare(
      "SELECT id, customer_id, total_amount, status FROM monthly_billing WHERE id = ?"
    ).bind(body.bill_id).first<{
      id: string;
      customer_id: string;
      total_amount: number;
      status: string;
    }>();

    if (!bill) {
      return c.json({ error: "帳單不存在" }, 404);
    }

    // 權限檢查：只能付自己的帳單
    if (bill.customer_id !== tokenRecord.user_id) {
      return c.json({ error: "無權付款此帳單" }, 403);
    }

    // 檢查是否已付款
    if (bill.status === "paid") {
      return c.json({ error: "帳單已付款" }, 400);
    }

    // 檢查金額
    if (body.amount !== bill.total_amount) {
      return c.json({ 
        error: "金額不符", 
        expected: bill.total_amount,
        provided: body.amount,
      }, 400);
    }

    const paymentId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 更新帳單狀態
    await c.env.DB.prepare(
      "UPDATE monthly_billing SET status = 'paid', paid_at = ? WHERE id = ?"
    ).bind(now, body.bill_id).run();

    return c.json({
      success: true,
      payment_id: paymentId,
      status: "completed",
      message: "付款成功",
    });
  }
}

// GET /api/billing/payments - 付款紀錄
export class BillingPaymentList extends OpenAPIRoute {
  schema = {
    tags: ["Billing"],
    summary: "查詢付款紀錄",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        bill_id: z.string().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "查詢成功",
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
    const tokenRecord = await c.env.DB.prepare(
      "SELECT user_id FROM tokens WHERE id = ?"
    ).bind(token).first<{ user_id: string }>();

    if (!tokenRecord) {
      return c.json({ error: "Token 無效" }, 401);
    }

    const query = c.req.query();

    // 查詢已付款的帳單
    let sql = `
      SELECT mb.id, mb.cycle_start, mb.cycle_end, mb.total_amount, mb.paid_at
      FROM monthly_billing mb
      WHERE mb.customer_id = ? AND mb.status = 'paid'
    `;
    const params: string[] = [tokenRecord.user_id];

    if (query.bill_id) {
      sql += " AND mb.id = ?";
      params.push(query.bill_id);
    }

    if (query.date_from) {
      sql += " AND mb.paid_at >= ?";
      params.push(query.date_from);
    }

    if (query.date_to) {
      sql += " AND mb.paid_at <= ?";
      params.push(query.date_to);
    }

    sql += " ORDER BY mb.paid_at DESC LIMIT 50";

    const result = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      payments: (result.results || []).map((bill: any) => ({
        bill_id: bill.id,
        period: `${bill.cycle_start} - ${bill.cycle_end}`,
        amount: bill.total_amount,
        paid_at: bill.paid_at,
      })),
    });
  }
}
