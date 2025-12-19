import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

const sha256Hex = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};

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

    const body = await c.req.json<{
      user_name: string;
      email: string;
      password: string;
      phone_number?: string;
      address?: string;
      user_class: string;
    }>();

    if (!body.user_name || !body.email || !body.password || !body.user_class) {
      return c.json({ error: "必填欄位缺失" }, 400);
    }

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
