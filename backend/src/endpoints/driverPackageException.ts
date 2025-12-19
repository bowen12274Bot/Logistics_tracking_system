import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AuthUser = { id: string; user_class: string };

async function requireDriver(c: AppContext) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false as const, res: c.json({ error: "Token missing" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
    .bind(token)
    .first<{ user_id: string }>();

  if (!tokenRecord) {
    return { ok: false as const, res: c.json({ error: "Invalid token" }, 401) };
  }

  const user = await c.env.DB.prepare("SELECT id, user_class FROM users WHERE id = ?")
    .bind(tokenRecord.user_id)
    .first<AuthUser>();

  if (!user || user.user_class !== "driver") {
    return { ok: false as const, res: c.json({ error: "Forbidden" }, 403) };
  }

  return { ok: true as const, user };
}

// POST /api/driver/packages/:packageId/exception - driver report exception (creates package_exceptions + event)
export class DriverPackageExceptionCreate extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Driver report package exception",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        packageId: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              reason_code: z.string().optional(),
              description: z.string().min(1),
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
    },
  };

  async handle(c: AppContext) {
    const auth = await requireDriver(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const packageId = String(data.params.packageId).trim();
    const body = data.body as { reason_code?: string; description: string; location?: string };

    const pkg = await c.env.DB.prepare("SELECT id FROM packages WHERE id = ? LIMIT 1").bind(packageId).first();
    if (!pkg) return c.json({ error: "Package not found" }, 404);

    const now = new Date().toISOString();
    const exceptionId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_exceptions (
        id, package_id, reason_code, description,
        reported_by, reported_role, reported_at,
        handled
      ) VALUES (?, ?, ?, ?, ?, 'driver', ?, 0)
      `,
    )
      .bind(
        exceptionId,
        packageId,
        body.reason_code ?? null,
        body.description,
        auth.user.id,
        now,
      )
      .run();

    // If exception is reported before pickup starts, cancel the current task segment so it won't block the driver list.
    // If exception happens after pickup, task stays active but will be shown in a separate "exception" list in UI.
    await c.env.DB.prepare(
      `
      UPDATE delivery_tasks
      SET status = 'canceled', updated_at = ?
      WHERE package_id = ?
        AND assigned_driver_id = ?
        AND status IN ('pending','accepted')
      `,
    )
      .bind(now, packageId, auth.user.id)
      .run();

    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(
      `
      INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(eventId, packageId, "exception", body.description, now, body.location ?? null)
      .run();

    return c.json({ success: true, exception_id: exceptionId });
  }
}

// GET /api/driver/exceptions - driver exception reports list
export class DriverPackageExceptionList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Driver exception reports list",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
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
    const auth = await requireDriver(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const limit = data.query.limit;

    const rows = await c.env.DB.prepare(
      `
      SELECT
        pe.id,
        pe.package_id,
        p.tracking_number,
        p.status AS package_status,
        pe.reason_code,
        pe.description,
        pe.reported_at,
        pe.handled,
        pe.handled_at
      FROM package_exceptions pe
      JOIN packages p ON p.id = pe.package_id
      WHERE pe.reported_by = ? AND pe.reported_role = 'driver'
      ORDER BY COALESCE(pe.reported_at, '') DESC
      LIMIT ?
      `,
    )
      .bind(auth.user.id, limit)
      .all();

    return c.json({ success: true, exceptions: rows.results ?? [] });
  }
}
