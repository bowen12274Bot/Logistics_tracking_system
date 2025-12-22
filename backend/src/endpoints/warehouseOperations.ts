import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireWarehouse } from "../utils/authUtils";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";

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
    const auth = await requireWarehouse(c);
    if (auth.ok === false) return (auth as any).res;

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

      const terminal = await getTerminalStatus(c.env.DB, String(pkg.id));
      if (terminal) {
        results.failed.push({ id: pkgId, reason: `Package is terminal (${terminal})` });
        continue;
      }
      if (await hasActiveException(c.env.DB, String(pkg.id))) {
        results.failed.push({ id: pkgId, reason: "Package has active exception" });
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
