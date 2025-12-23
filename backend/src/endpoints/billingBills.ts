import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireAuth } from "../utils/authUtils";

// GET /api/billing/bills - 帳單列表
export class BillingBillList extends OpenAPIRoute {
  schema = {
    tags: ["Billing"],
    summary: "查詢帳單列表",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        status: z.enum(["pending", "paid", "overdue"]).optional(),
        period_from: z.string().optional(),
        period_to: z.string().optional(),
        customer_id: z.string().optional(),
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
        description: "權限不足",
      },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAuth(c);
    if (auth.ok === false) return (auth as any).res;
    const user = auth.user;

    const query = c.req.query();

    // 客戶只能查自己的帳單
    const isEmployee = user.user_type === "employee";
    const allowedEmployeeRoles = ["customer_service", "admin"];
    const canViewAll = isEmployee && allowedEmployeeRoles.includes(user.user_class);

    // 如果客戶嘗試用 customer_id 查別人
    if (!canViewAll && query.customer_id && query.customer_id !== user.id) {
      return c.json({ error: "無權查詢他人帳單" }, 403);
    }

    const customerId = canViewAll && query.customer_id 
      ? query.customer_id 
      : (canViewAll ? null : user.id);

    let sql = `
      SELECT mb.id, mb.customer_id, mb.cycle_start, mb.cycle_end, 
             mb.status, mb.total_amount, mb.due_date, mb.created_at,
             u.user_name as customer_name
      FROM monthly_billing mb
      LEFT JOIN users u ON mb.customer_id = u.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (customerId) {
      sql += " AND mb.customer_id = ?";
      params.push(customerId);
    }

    if (query.status) {
      sql += " AND mb.status = ?";
      params.push(query.status);
    }

    if (query.period_from) {
      sql += " AND mb.cycle_start >= ?";
      params.push(query.period_from);
    }

    if (query.period_to) {
      sql += " AND mb.cycle_end <= ?";
      params.push(query.period_to);
    }

    sql += " ORDER BY mb.created_at DESC LIMIT 50";

    const stmt = c.env.DB.prepare(sql);
    const result = params.length > 0 
      ? await stmt.bind(...params).all()
      : await stmt.all();

    // 計算每個帳單的包裹數量
    const bills = [];
    for (const bill of (result.results || [])) {
      const b = bill as any;
      const itemCount = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM monthly_billing_items WHERE monthly_billing_id = ?"
      ).bind(b.id).first<{ count: number }>();

      bills.push({
        id: b.id,
        customer_id: b.customer_id,
        customer_name: b.customer_name,
        period: `${b.cycle_start} - ${b.cycle_end}`,
        total_amount: b.total_amount || 0,
        package_count: itemCount?.count || 0,
        status: b.status || "pending",
        due_date: b.due_date,
        created_at: b.created_at,
      });
    }

    return c.json({
      success: true,
      bills,
    });
  }
}

// GET /api/billing/bills/:billId - 帳單明細
export class BillingBillDetail extends OpenAPIRoute {
  schema = {
    tags: ["Billing"],
    summary: "查詢帳單明細",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        billId: z.string(),
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
        description: "無權查詢此帳單",
      },
      "404": {
        description: "帳單不存在",
      },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAuth(c);
    if (auth.ok === false) return (auth as any).res;
    const user = auth.user;

    const { billId } = c.req.param() as { billId: string };

    // 查詢帳單
    const bill = await c.env.DB.prepare(`
      SELECT mb.*, u.user_name as customer_name
      FROM monthly_billing mb
      LEFT JOIN users u ON mb.customer_id = u.id
      WHERE mb.id = ?
    `).bind(billId).first<any>();

    if (!bill) {
      return c.json({ error: "帳單不存在" }, 404);
    }

    // 權限檢查
    const isEmployee = user.user_type === "employee";
    const allowedRoles = ["customer_service", "admin"];
    const canViewAll = isEmployee && allowedRoles.includes(user.user_class);

    if (!canViewAll && bill.customer_id !== user.id) {
      return c.json({ error: "無權查詢此帳單" }, 403);
    }

    // 查詢帳單項目
    const items = await c.env.DB.prepare(`
      SELECT mbi.package_id, p.tracking_number, p.delivery_time, p.created_at,
             pay.total_amount as cost
      FROM monthly_billing_items mbi
      LEFT JOIN packages p ON mbi.package_id = p.id
      LEFT JOIN payments pay ON p.id = pay.package_id
      WHERE mbi.monthly_billing_id = ?
    `).bind(billId).all();

    return c.json({
      success: true,
      bill: {
        id: bill.id,
        period: `${bill.cycle_start} - ${bill.cycle_end}`,
        customer: {
          id: bill.customer_id,
          name: bill.customer_name,
        },
        total_amount: bill.total_amount || 0,
        status: bill.status || "pending",
        items: (items.results || []).map((item: any) => ({
          package_id: item.package_id,
          tracking_number: item.tracking_number,
          service_level: item.delivery_time,
          cost: item.cost || 0,
          shipped_at: item.created_at,
        })),
        due_date: bill.due_date,
      },
    });
  }
}
