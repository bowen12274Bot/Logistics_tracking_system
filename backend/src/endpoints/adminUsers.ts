import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireAdmin } from "../utils/authUtils";
import { sha256Hex } from "../utils/cryptoUtils";

// POST /api/admin/users - 建立員工帳號
export class AdminUserCreate extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "管理員建立員工帳號",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              user_name: z.string(),
              email: z.string().email(),
              password: z.string().min(6),
              phone_number: z.string().optional(),
              address: z.string().optional(),
              user_class: z.enum(["customer_service", "warehouse_staff", "driver", "admin"]),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "建立成功",
      },
      "400": {
        description: "必填欄位缺失",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非 admin 角色",
      },
      "409": {
        description: "Email 已存在",
      },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;

    // Use getValidatedData instead of manually parsing json for better type safety if preferred,
    // but keeping consistent with original logic structure for now is fine, just replacing auth.
    // However, chanfana usually provides validated body via getValidatedData. 
    // The original code used c.req.json(). Let's stick to c.req.json() to minimize logical changes unless necessary,
    // but using getValidatedData is safer. Let's use getValidatedData since we have the schema.
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;

    // 檢查 email 是否已存在
    const existingUser = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).bind(body.email).first();

    if (existingUser) {
      return c.json({ error: "Email 已存在" }, 409);
    }

    const userId = crypto.randomUUID();
    const passwordHash = await sha256Hex(body.password);
    const address = body.address?.trim() || null;

    await c.env.DB.prepare(`
      INSERT INTO users (id, user_name, email, password_hash, phone_number, address, user_type, user_class)
      VALUES (?, ?, ?, ?, ?, ?, 'employee', ?)
    `).bind(
      userId,
      body.user_name,
      body.email,
      passwordHash,
      body.phone_number || null,
      address,
      body.user_class
    ).run();

    return c.json({
      success: true,
      user: {
        id: userId,
        user_name: body.user_name,
        email: body.email,
        address,
        user_type: "employee",
        user_class: body.user_class,
      },
    });
  }
}
