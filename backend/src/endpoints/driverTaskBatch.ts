import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireDriver } from "../utils/authUtils";

// POST /api/driver/tasks/batch-arrive - 批量標記到達（用於付款視窗）
export class DriverTaskBatchArrive extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "批量標記任務到達（用於付款視窗）",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              task_ids: z.array(z.string().min(1)).min(1).max(50),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "批量操作結果",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "非駕駛員",
      },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body as { task_ids: string[] };
    const taskIds = body.task_ids;

    const results: Array<{ task_id: string; status: string; error?: string }> = [];
    const now = new Date().toISOString();

    // 批量處理每個任務
    for (const taskId of taskIds) {
      try {
        // 檢查任務是否屬於該司機且狀態正確
        const task = await c.env.DB.prepare(
          `SELECT id, package_id, assigned_driver_id, status, to_location
           FROM delivery_tasks 
           WHERE id = ? 
           LIMIT 1`
        )
          .bind(taskId)
          .first<{
            id: string;
            package_id: string;
            assigned_driver_id: string | null;
            status: string;
            to_location: string | null;
          }>();

        if (!task) {
          results.push({ task_id: taskId, status: "error", error: "Task not found" });
          continue;
        }

        if (task.assigned_driver_id !== auth.user.id) {
          results.push({ task_id: taskId, status: "error", error: "Not assigned to you" });
          continue;
        }

        if (task.status === "completed" || task.status === "canceled") {
          results.push({ task_id: taskId, status: "skipped", error: "Task already terminal" });
          continue;
        }

        // 新增 arrive 事件記錄
        const eventId = crypto.randomUUID();
        const location = task.to_location ?? null;
        
        await c.env.DB.prepare(`
          INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
          VALUES (?, ?, 'arrived', '司機到達', ?, ?)
        `)
          .bind(eventId, task.package_id, now, location)
          .run();

        results.push({ task_id: taskId, status: "arrived" });
      } catch (e: any) {
        results.push({
          task_id: taskId,
          status: "error",
          error: String(e?.message ?? e),
        });
      }
    }

    const successCount = results.filter((r) => r.status === "arrived").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;

    return c.json({
      success: true,
      summary: {
        total: taskIds.length,
        arrived: successCount,
        errors: errorCount,
        skipped: skippedCount,
      },
      results,
    });
  }
}
