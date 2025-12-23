import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireRole } from "../utils/authUtils";

export class CustomerServiceExceptionList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Customer service exception pool list",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        handled: z.coerce.boolean().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireRole(c, ["customer_service"]);
    if (auth.ok === false) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const handled = data.query.handled;
    const limit = data.query.limit;

    const where: string[] = [];
    const params: any[] = [];
    if (handled !== undefined) {
      where.push("pe.handled = ?");
      params.push(handled ? 1 : 0);
    } else {
      where.push("pe.handled = 0");
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await c.env.DB.prepare(
      `
      SELECT
        pe.*,
        p.tracking_number,
        p.status AS package_status
      FROM package_exceptions pe
      JOIN packages p ON p.id = pe.package_id
      ${whereSql}
      ORDER BY COALESCE(pe.reported_at, '') DESC
      LIMIT ?
      `,
    )
      .bind(...params, limit)
      .all();

    return c.json({ success: true, exceptions: rows.results ?? [] });
  }
}

export class CustomerServiceExceptionHandle extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Customer service handle an exception (resolve + decide next action)",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        exceptionId: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              action: z.enum(["resume", "cancel"]),
              handling_report: z.string().min(1),
              location: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "OK" },
      "400": { description: "Invalid request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireRole(c, ["customer_service"]);
    if (auth.ok === false) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const exceptionId = String(data.params.exceptionId).trim();
    const body = data.body as { action: "resume" | "cancel"; handling_report: string; location?: string };

    const record = await c.env.DB.prepare(
      "SELECT id, package_id, handled, reason_code FROM package_exceptions WHERE id = ? LIMIT 1",
    )
      .bind(exceptionId)
      .first<{ id: string; package_id: string; handled: number; reason_code: string | null }>();
    if (!record) return c.json({ error: "Exception not found" }, 404);
    if (Number(record.handled) === 1) return c.json({ error: "Already handled" }, 409);

    const pkg = await c.env.DB.prepare("SELECT status FROM packages WHERE id = ? LIMIT 1")
      .bind(record.package_id)
      .first<{ status: string | null }>();
    const pkgStatus = String(pkg?.status ?? "").trim().toLowerCase();
    if (pkgStatus && ["delivered", "delivery_failed"].includes(pkgStatus)) {
      return c.json({ error: "Package is terminal", status: pkgStatus }, 409);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `
      UPDATE package_exceptions
      SET handled = 1, handled_by = ?, handled_at = ?, handling_report = ?
      WHERE id = ?
      `,
    )
      .bind(auth.user.id, now, body.handling_report, exceptionId)
      .run();

    if (body.action === "cancel") {
      await c.env.DB.prepare(
        `
        UPDATE delivery_tasks
        SET status = 'canceled', updated_at = ?
        WHERE package_id = ?
          AND status IN ('pending','accepted','in_progress')
        `,
      )
        .bind(now, record.package_id)
        .run();
    }

    const eventId = crypto.randomUUID();
    const details = body.action === "cancel" ? "異常已處理：取消委託" : "異常已處理：恢復配送";
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, 'exception_resolved', ?, ?, ?)
      `,
    )
      .bind(eventId, record.package_id, details, now, body.location ?? null)
      .run();

    let deliveryFailedEventId: string | null = null;
    if (body.action === "cancel") {
      const loc = await c.env.DB.prepare(
        `
        SELECT location
        FROM package_events
        WHERE package_id = ?
          AND delivery_status = 'exception'
        ORDER BY events_at DESC
        LIMIT 1
        `,
      )
        .bind(record.package_id)
        .first<{ location: string | null }>();

      const now2 = new Date(Date.parse(now) + 1).toISOString();
      const reason = String(record.reason_code ?? "").trim();
      const failedDetails = reason ? `配送失敗：[${reason}] 客服取消委託` : "配送失敗：客服取消委託";

      deliveryFailedEventId = crypto.randomUUID();
      await c.env.DB.prepare(
        `
        INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
        VALUES (?, ?, 'delivery_failed', ?, ?, ?)
        `,
      )
        .bind(deliveryFailedEventId, record.package_id, failedDetails, now2, loc?.location ?? null)
        .run();
    }

    return c.json({ success: true, event_id: eventId, delivery_failed_event_id: deliveryFailedEventId, action: body.action });
  }
}
