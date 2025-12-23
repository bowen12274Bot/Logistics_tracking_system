import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// PATCH /api/admin/billing/bills/:billId - 手動更新帳單
export class BillingAdminUpdate extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "手動修改帳單 (Admin)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ billId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              total_amount: z.number().int().optional(),
              status: z.enum(["pending", "paid", "overdue"]).optional(),
              due_date: z.string().optional(),
              notes: z.string().optional(), // In a real schema we might add a notes column, here we just allow it but maybe ignore or store in metadata if schema allowed
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "更新成功" },
      "401": { description: "未認證" },
      "403": { description: "權限不足" },
      "404": { description: "帳單不存在" },
    },
  };

  async handle(c: AppContext) {
    // Admin check
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return c.json({ error: "Token missing" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?").bind(token).first<{ user_id: string }>();
    if (!tokenRecord) return c.json({ error: "Invalid token" }, 401);
    const user = await c.env.DB.prepare("SELECT user_class FROM users WHERE id = ?").bind(tokenRecord.user_id).first<{ user_class: string }>();
    if (!user || user.user_class !== "admin") return c.json({ error: "Forbidden" }, 403);

    const { billId } = c.req.param() as { billId: string };
    const body = await c.req.json<any>();

    // Dynamic SQL update
    let sql = "UPDATE monthly_billing SET ";
    const params: any[] = [];
    const updates: string[] = [];

    if (body.total_amount !== undefined) {
      updates.push("total_amount = ?");
      params.push(body.total_amount);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      params.push(body.status);
    }
    if (body.due_date !== undefined) {
      updates.push("due_date = ?");
      params.push(body.due_date);
    }

    if (updates.length === 0) {
      return c.json({ success: true, message: "No changes" });
    }

    sql += updates.join(", ");
    sql += " WHERE id = ?";
    params.push(billId);

    const res = await c.env.DB.prepare(sql).bind(...params).run();
    if (!res.success) return c.json({ error: "Update failed" }, 500);

    return c.json({ success: true });
  }
}

// POST /api/admin/billing/bills/:billId/items - 手動新增項目
export class BillingAdminAddItem extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "手動新增帳單項目 (Admin)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ billId: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              package_id: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "新增成功" },
      "400": { description: "加入失敗" },
    },
  };

  async handle(c: AppContext) {
    // Admin check omitted for brevity but should be here
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?").bind(token).first<{user_id: string}>();
    const user = await c.env.DB.prepare("SELECT user_class FROM users WHERE id = ?").bind(tokenRecord?.user_id).first<{user_class: string}>();
    if (user?.user_class !== "admin") return c.json({ error: "Forbidden" }, 403);

    const { billId } = c.req.param() as { billId: string };
    const { package_id } = await c.req.json<{ package_id: string }>();

    // Logic: Add item, find package cost, update bill total
    // Reuse service logic if possible?
    try {
      // 1. Check package exists and get cost
      const pkg = await c.env.DB.prepare("SELECT customer_id FROM packages WHERE id = ?").bind(package_id).first<{customer_id: string}>();
      if (!pkg) return c.json({ error: "Package not found" }, 404);

      // dynamic import service
      const { addPackageToBill } = await import("../services/billingService");
      
      // Note: addPackageToBill finds bill by cycle. Here we want to enforce specific bill ID.
      // But addPackageToBill creates bill if not exists based on cycle.
      // Since we want to add to *this* bill ID specifically, we might need a specific logic or ensure the package date matches this bill cycle.
      // For simplicity/requirement "manual modify", lets do direct insert.

      const payment = await c.env.DB.prepare("SELECT total_amount FROM payments WHERE package_id = ?").bind(package_id).first<{total_amount: number}>();
      const amount = payment?.total_amount || 0;

      const itemId = crypto.randomUUID();
      await c.env.DB.prepare("INSERT INTO monthly_billing_items (id, monthly_billing_id, package_id) VALUES (?, ?, ?)")
        .bind(itemId, billId, package_id).run();
      
      await c.env.DB.prepare("UPDATE monthly_billing SET total_amount = total_amount + ? WHERE id = ?")
        .bind(amount, billId).run();

      return c.json({ success: true, item_id: itemId });
    } catch (e: any) {
      return c.json({ error: String(e.message) }, 400);
    }
  }
}

// DELETE /api/admin/billing/bills/:billId/items/:itemId - 手動移除項目
export class BillingAdminRemoveItem extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "手動移除帳單項目 (Admin)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ billId: z.string(), itemId: z.string() }),
    },
    responses: {
      "200": { description: "移除成功" },
    },
  };

  async handle(c: AppContext) {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?").bind(token).first<{user_id: string}>();
    const user = await c.env.DB.prepare("SELECT user_class FROM users WHERE id = ?").bind(tokenRecord?.user_id).first<{user_class: string}>();
    if (user?.user_class !== "admin") return c.json({ error: "Forbidden" }, 403);

    const { billId, itemId } = c.req.param() as { billId: string; itemId: string };

    // Need to subtract amount before deleting
    // Find package_id from item
    const item = await c.env.DB.prepare("SELECT package_id FROM monthly_billing_items WHERE id = ?").bind(itemId).first<{package_id: string}>();
    if (!item) return c.json({ error: "Item not found" }, 404);

    const payment = await c.env.DB.prepare("SELECT total_amount FROM payments WHERE package_id = ?").bind(item.package_id).first<{total_amount: number}>();
    const amount = payment?.total_amount || 0;

    await c.env.DB.prepare("DELETE FROM monthly_billing_items WHERE id = ?").bind(itemId).run();
    await c.env.DB.prepare("UPDATE monthly_billing SET total_amount = total_amount - ? WHERE id = ?").bind(amount, billId).run();

    return c.json({ success: true });
  }
}
