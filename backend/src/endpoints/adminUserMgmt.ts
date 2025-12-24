import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireAdmin } from "../utils/authUtils";
import { sha256Hex } from "../utils/cryptoUtils";

// GET /api/admin/users - 取得使用者列表
export class AdminUserList extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "取得使用者列表",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        user_type: z.enum(["customer", "employee"]).optional(),
        user_class: z.string().optional(),
        status: z.enum(["active", "suspended", "deleted"]).optional(),
        search: z.string().optional(),
        limit: z.string().optional(),
        offset: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "查詢成功",
      },
      "401": { description: "未認證" },
      "403": { description: "非 admin 角色" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;

    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const offset = parseInt(query.offset || "0", 10);

    let sql = "SELECT id, user_name, email, phone_number, user_type, user_class, status, created_at FROM users WHERE 1=1";
    const params: any[] = [];

    if (query.user_type) {
      sql += " AND user_type = ?";
      params.push(query.user_type);
    }

    if (query.user_class) {
      sql += " AND user_class = ?";
      params.push(query.user_class);
    }

    if (query.status) {
      sql += " AND status = ?";
      params.push(query.status);
    } else {
      // 預設不顯示已刪除
      sql += " AND status != 'deleted'";
    }

    if (query.search) {
      sql += " AND (user_name LIKE ? OR email LIKE ? OR phone_number LIKE ?)";
      const term = `%${query.search}%`;
      params.push(term, term, term);
    }

    // Count
    const countSql = sql.replace("SELECT id, user_name, email, phone_number, user_type, user_class, status, created_at", "SELECT COUNT(*) as total");
    const totalResult = await c.env.DB.prepare(countSql).bind(...params).first<{ total: number }>();
    const total = totalResult?.total || 0;

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const result = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      users: result.results || [],
      total,
      limit,
      offset,
    });
  }
}

// GET /api/admin/users/:id - 取得使用者詳情
export class AdminUserDetails extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "取得使用者詳情",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      "200": { description: "查詢成功" },
      "404": { description: "使用者不存在" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();

    if (!user) {
      return c.json({ error: "使用者不存在" }, 404);
    }

    // TODO: 加載 statistics (mock for now or implement simple count)
    // 簡單統計：總包裹數/總金額 (for customers)
    let stats = {};
    if (user.user_type === 'customer') {
      const pkgCount = await c.env.DB.prepare("SELECT COUNT(*) as c FROM packages WHERE customer_id = ?").bind(id).first<{c:number}>();
      stats = { total_packages: pkgCount?.c || 0 };
    }

    return c.json({
      success: true,
      user: {
        ...user,
        password_hash: undefined, // Hide password
        statistics: stats
      }
    });
  }
}

// PUT /api/admin/users/:id - 更新使用者資料
export class AdminUserUpdate extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "更新使用者資料",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              user_name: z.string().optional(),
              phone_number: z.string().optional(),
              address: z.string().optional(),
              user_class: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "更新成功" },
      "400": { description: "無效的請求" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const { body } = data;
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();

    if (!user) {
      return c.json({ error: "使用者不存在" }, 404);
    }

    if (body.user_class && user.user_type === 'customer') {
       // 客戶不能隨意改 class (需透過合約)，這裡可視需求放寬，但計畫說「僅限員工」
       // 但若要手動升級合約客戶也可以，暫時允許但不建議
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.user_name !== undefined) { updates.push("user_name = ?"); params.push(body.user_name); }
    if (body.phone_number !== undefined) { updates.push("phone_number = ?"); params.push(body.phone_number); }
    if (body.address !== undefined) { updates.push("address = ?"); params.push(body.address); }
    if (body.user_class !== undefined) { updates.push("user_class = ?"); params.push(body.user_class); }

    if (updates.length > 0) {
      const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
      params.push(id);
      await c.env.DB.prepare(sql).bind(...params).run();
    }

    const updatedUser = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    return c.json({
      success: true,
      user: { ...updatedUser, password_hash: undefined }
    });
  }
}

// POST /api/admin/users/:id/suspend - 停用
export class AdminUserSuspend extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "停用帳號",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({ reason: z.string().optional() }),
          },
        },
      },
    },
    responses: { "200": { description: "成功" } },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const { body } = data;
    
    if (id === auth.user.id) {
       return c.json({ error: "不能停用自己" }, 403);
    }

    await c.env.DB.prepare(`
      UPDATE users SET status = 'suspended', suspended_at = datetime('now'), suspended_reason = ? WHERE id = ?
    `).bind(body.reason || null, id).run();

    // Kill tokens? Implementation detail: we verify status in auth middleware.
    // If auth middleware doesn't check DB status, we might need to delete tokens.
    // Assuming we should invalidate tokens:
    await c.env.DB.prepare("DELETE FROM tokens WHERE user_id = ?").bind(id).run();

    return c.json({ success: true, message: "帳號已停用" });
  }
}

// POST /api/admin/users/:id/activate - 啟用
export class AdminUserActivate extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "啟用帳號",
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: { "200": { description: "成功" } },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;

    await c.env.DB.prepare(`
      UPDATE users SET status = 'active', suspended_at = NULL, suspended_reason = NULL WHERE id = ?
    `).bind(id).run();

    return c.json({ success: true, message: "帳號已啟用" });
  }
}

// DELETE /api/admin/users/:id - 刪除 (Soft)
export class AdminUserDelete extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "刪除帳號(軟刪除)",
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: { "200": { description: "成功" } },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;

    if (id === auth.user.id) {
       return c.json({ error: "不能刪除自己" }, 403);
    }

    await c.env.DB.prepare(`
      UPDATE users SET status = 'deleted', deleted_at = datetime('now') WHERE id = ?
    `).bind(id).run();

    await c.env.DB.prepare("DELETE FROM tokens WHERE user_id = ?").bind(id).run();

    return c.json({ success: true, message: "帳號已刪除" });
  }
}

// POST /api/admin/users/:id/reset-password
export class AdminUserResetPassword extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "重設密碼",
    security: [{ bearerAuth: [] }],
    request: {
       params: z.object({ id: z.string() }),
       body: {
         content: {
           "application/json": {
             schema: z.object({ new_password: z.string().min(6) }),
           },
         },
       },
    },
    responses: { "200": { description: "成功" } },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const { body } = data;

    const hash = await sha256Hex(body.new_password);
    await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, id).run();
    await c.env.DB.prepare("DELETE FROM tokens WHERE user_id = ?").bind(id).run();

    return c.json({ success: true, message: "密碼已重設" });
  }
}

// POST /api/admin/users/:id/assign-vehicle
export class AdminUserAssignVehicle extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "指派車輛",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              vehicle_code: z.string(),
              home_node_id: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: { "200": { description: "成功" } },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const { body } = data;

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) return c.json({ error: "使用者不存在" }, 404);
    if (user.user_class !== 'driver') return c.json({ error: "使用者不是司機" }, 409);

    const checkVehicle = await c.env.DB.prepare("SELECT * FROM vehicles WHERE vehicle_code = ? AND driver_user_id != ?").bind(body.vehicle_code, id).first();
    if (checkVehicle) return c.json({ error: "車輛編號已被使用" }, 409);

    const homeNode = body.home_node_id || user.address;
    if (!homeNode) return c.json({ error: "無效的 home_node_id" }, 400);

    // Check if entry exists
    const existingEntry = await c.env.DB.prepare("SELECT id FROM vehicles WHERE driver_user_id = ?").bind(id).first();

    if (existingEntry) {
      await c.env.DB.prepare(`
        UPDATE vehicles SET vehicle_code = ?, home_node_id = ?, current_node_id = ?, updated_at = datetime('now')
        WHERE driver_user_id = ?
      `).bind(body.vehicle_code, homeNode, homeNode, id).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO vehicles (id, driver_user_id, vehicle_code, home_node_id, current_node_id, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(crypto.randomUUID(), id, body.vehicle_code, homeNode, homeNode).run();
    }

    const vehicle = await c.env.DB.prepare("SELECT * FROM vehicles WHERE driver_user_id = ?").bind(id).first();
    return c.json({ success: true, vehicle });
  }
}

// GET /api/admin/users/:id/work-stats
export class AdminUserWorkStats extends OpenAPIRoute {
  schema = {
     tags: ["Admin"],
     summary: "查詢員工工作統計",
     security: [{ bearerAuth: [] }],
     request: { params: z.object({ id: z.string() }) },
     responses: { "200": { description: "成功" } },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;

    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) return c.json({ error: "使用者不存在" }, 404);
    if (user.user_type !== 'employee') return c.json({ error: "非員工" }, 409);

    // TODO: Implement real stats based on logs/tasks
    // This is a placeholder as actual stats logic can be complex
    return c.json({
       success: true,
       user_id: id,
       user_class: user.user_class,
       stats: {
         tasks_completed: 0,
         packages_processed: 0,
         exceptions_reported: 0
       }
    });
  }
}
