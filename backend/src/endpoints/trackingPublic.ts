import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// GET /api/tracking/:trackingNumber - 公開追蹤查詢
export class TrackingPublic extends OpenAPIRoute {
  schema = {
    tags: ["Tracking"],
    summary: "公開追蹤查詢",
    request: {
      params: z.object({
        trackingNumber: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "查詢成功",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              tracking_number: z.string(),
              current_status: z.string(),
              current_location: z.string().nullable(),
              updated_at: z.string().nullable(),
              estimated_delivery: z.string().nullable(),
              events: z.array(z.object({
                status: z.string(),
                description: z.string().nullable(),
                location: z.string().nullable(),
                timestamp: z.string(),
              })),
            }),
          },
        },
      },
      "404": {
        description: "追蹤編號不存在",
      },
    },
  };

  async handle(c: AppContext) {
    const { trackingNumber } = c.req.param() as { trackingNumber: string };

    // 查詢包裹
    const pkg = await c.env.DB.prepare(
      "SELECT id, tracking_number, status, estimated_delivery, created_at FROM packages WHERE tracking_number = ?"
    ).bind(trackingNumber).first<{
      id: string;
      tracking_number: string;
      status: string;
      estimated_delivery: string | null;
      created_at: string | null;
    }>();

    if (!pkg) {
      return c.json({ error: "追蹤編號不存在" }, 404);
    }

    // 查詢事件歷史
    const events = await c.env.DB.prepare(
      "SELECT delivery_status, delivery_details, location, events_at FROM package_events WHERE package_id = ? ORDER BY events_at ASC"
    ).bind(pkg.id).all<{
      delivery_status: string;
      delivery_details: string | null;
      location: string | null;
      events_at: string;
    }>();

    // 取得最新位置
    const latestEvent = events.results?.length 
      ? events.results[events.results.length - 1] 
      : null;

    return c.json({
      success: true,
      tracking_number: pkg.tracking_number,
      current_status: pkg.status || "created",
      current_location: latestEvent?.location || null,
      updated_at: latestEvent?.events_at ?? pkg.created_at ?? null,
      estimated_delivery: pkg.estimated_delivery,
      events: (events.results || []).map(e => ({
        status: e.delivery_status,
        description: e.delivery_details,
        location: e.location,
        timestamp: e.events_at,
      })),
    });
  }
}
