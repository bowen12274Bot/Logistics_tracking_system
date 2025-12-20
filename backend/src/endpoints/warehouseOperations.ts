import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// POST /api/warehouse/batch-operation - 倉儲批次操作
export class WarehouseBatchOperation extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "倉儲批次操作",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              operation: z.enum(["warehouse_in", "warehouse_out", "sorting"]),
              package_ids: z.array(z.string()),
              location_id: z.string(),
              note: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "操作成功",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非倉儲人員",
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

    if (!user || user.user_class !== "warehouse_staff") {
      return c.json({ error: "僅倉儲人員可使用此功能" }, 403);
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body as {
      operation: "warehouse_in" | "warehouse_out" | "sorting";
      package_ids: string[];
      location_id: string;
      note?: string;
    };

    if (!body.package_ids || body.package_ids.length === 0) {
      return c.json({ error: "請提供至少一個包裹 ID" }, 400);
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[],
    };

    const now = new Date().toISOString();

    for (const pkgId of body.package_ids) {
      // 檢查包裹是否存在
      const pkg = await c.env.DB.prepare(
        "SELECT id FROM packages WHERE id = ? OR tracking_number = ?"
      ).bind(pkgId, pkgId).first<{ id: string }>();

      if (!pkg) {
        results.failed.push({ id: pkgId, reason: "包裹不存在" });
        continue;
      }

      try {
        // 新增事件記錄
        const eventId = crypto.randomUUID();
        await c.env.DB.prepare(`
          INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          eventId,
          pkg.id,
          body.operation,
          body.note || null,
          now,
          body.location_id
        ).run();

        results.success.push(pkgId);
      } catch (e) {
        results.failed.push({ id: pkgId, reason: "處理失敗" });
      }
    }

    return c.json({
      success: true,
      operation: body.operation,
      location_id: body.location_id,
      processed: results.success.length,
      failed: results.failed.length,
      details: results,
    });
  }
}
