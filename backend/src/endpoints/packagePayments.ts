import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireAuth } from "../utils/authUtils";

type PaymentMethod = "cash" | "credit_card" | "online_bank" | "third_party";

function extractPaymentMethodFromDescriptionJson(descriptionJson: unknown): PaymentMethod | null {
  if (!descriptionJson || typeof descriptionJson !== "object") return null;
  const method = (descriptionJson as any).payment_method;
  if (method === "cash" || method === "credit_card" || method === "online_bank" || method === "third_party") return method;
  return null;
}

async function getNodeSubtype(db: D1Database, nodeId: string | null): Promise<"home" | "store" | null> {
  const id = String(nodeId ?? "").trim();
  if (!id) return null;
  const row = await db.prepare("SELECT subtype FROM nodes WHERE id = ? LIMIT 1").bind(id).first<{ subtype: string | null }>();
  const subtype = String(row?.subtype ?? "").trim().toLowerCase();
  if (subtype === "home" || subtype === "store") return subtype as any;
  return null;
}

async function hasEvent(db: D1Database, packageId: string, status: string) {
  const row = await db.prepare(
    "SELECT 1 AS ok FROM package_events WHERE package_id = ? AND LOWER(delivery_status) = LOWER(?) LIMIT 1",
  )
    .bind(packageId, status)
    .first();
  return !!row;
}

async function computePayableNow(db: D1Database, pkg: any, paymentMethod: PaymentMethod | null) {
  const paymentType = String(pkg?.payment_type ?? "").trim();
  const packageId = String(pkg?.id ?? "").trim();
  if (!packageId) return { ok: false as const, payable_now: false, reason: "Package not found" };

  // We do not allow paying monthly billing per-package here.
  if (paymentType === "monthly_billing") {
    return { ok: true as const, payable_now: false, reason: "Monthly billing is paid by bill" };
  }

  // Non-cash (mock) still needs to respect COD timing.
  if (paymentType === "cod") {
    const delivered = await hasEvent(db, packageId, "delivered");
    return delivered
      ? { ok: true as const, payable_now: true, reason: null }
      : { ok: true as const, payable_now: false, reason: "COD is payable after delivered" };
  }

  if (paymentType === "prepaid") {
    if (paymentMethod !== "cash") return { ok: true as const, payable_now: true, reason: null };

    const senderSubtype = await getNodeSubtype(db, pkg?.sender_address ?? null);
    if (senderSubtype === "store") return { ok: true as const, payable_now: true, reason: null };

    const pickedUp = await hasEvent(db, packageId, "picked_up");
    return pickedUp
      ? { ok: true as const, payable_now: true, reason: null }
      : { ok: true as const, payable_now: false, reason: "Cash prepaid at home is payable after picked_up" };
  }

  // Unknown payment_type: treat as not payable (safe default).
  return { ok: true as const, payable_now: false, reason: "Unsupported payment_type" };
}

// GET /api/payments/packages - list unpaid package charges payable by current user (prepaid payer or COD receiver)
export class PackagePaymentList extends OpenAPIRoute {
  schema = {
    tags: ["Payments"],
    summary: "List payable package charges",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        include_paid: z
          .string()
          .optional()
          .transform((v) => String(v ?? "").toLowerCase() === "true"),
        limit: z.coerce.number().int().min(1).max(200).optional().default(50),
      }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAuth(c);
    if (auth.ok === false) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const limit = data.query.limit;
    const includePaid = data.query.include_paid;

    const where: string[] = ["pay.payer_user_id = ?"];
    const params: any[] = [auth.user.id];

    if (!includePaid) where.push("pay.paid_at IS NULL");

    // Only list per-package payments here. Monthly billing is paid by bills.
    where.push("LOWER(p.payment_type) IN ('prepaid','cod')");

    const rows = await c.env.DB.prepare(
      `
      SELECT
        p.*,
        pay.total_amount AS total_amount,
        pay.paid_at AS paid_at,
        pay.payer_user_id AS payer_user_id
      FROM payments pay
      JOIN packages p ON p.id = pay.package_id
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(pay.paid_at, p.created_at) DESC
      LIMIT ?
      `,
    )
      .bind(...params, limit)
      .all<any>();

    const items = [];
    for (const row of rows.results ?? []) {
      let description: any = null;
      try {
        description = row.description_json ? JSON.parse(String(row.description_json)) : null;
      } catch {
        description = null;
      }

      const paymentMethod = extractPaymentMethodFromDescriptionJson(description);
      const { payable_now, reason } = await computePayableNow(c.env.DB, row, paymentMethod);

      items.push({
        package: {
          ...row,
          description_json: description,
          payment_method: paymentMethod,
        },
        amount: row.total_amount ?? 0,
        paid_at: row.paid_at ?? null,
        payer_user_id: row.payer_user_id ?? null,
        payable_now,
        reason,
      });
    }

    return c.json({ success: true, items });
  }
}

// POST /api/payments/packages/:packageId - pay a package charge (mock)
export class PackagePaymentPay extends OpenAPIRoute {
  schema = {
    tags: ["Payments"],
    summary: "Pay package charge",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ packageId: z.string().min(1) }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              payment_method: z.enum(["cash", "credit_card", "online_bank", "third_party"]),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Not payable yet" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAuth(c);
    if (auth.ok === false) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const packageId = String(data.params.packageId).trim();
    const body = data.body as { payment_method: PaymentMethod };

    const row = await c.env.DB.prepare(
      `
      SELECT p.*, pay.id AS payment_id, pay.paid_at AS paid_at, pay.payer_user_id AS payer_user_id
      FROM payments pay
      JOIN packages p ON p.id = pay.package_id
      WHERE p.id = ?
      LIMIT 1
      `,
    )
      .bind(packageId)
      .first<any>();

    if (!row) return c.json({ error: "Package not found" }, 404);
    if (String(row.payer_user_id) !== auth.user.id) return c.json({ error: "Forbidden" }, 403);
    if (row.paid_at) return c.json({ error: "Already paid" }, 409);

    let description: any = null;
    try {
      description = row.description_json ? JSON.parse(String(row.description_json)) : null;
    } catch {
      description = null;
    }

    const storedMethod = extractPaymentMethodFromDescriptionJson(description);
    const { payable_now, reason } = await computePayableNow(c.env.DB, row, body.payment_method ?? storedMethod);
    if (!payable_now) return c.json({ error: reason || "Not payable yet" }, 409);

    const now = new Date().toISOString();
    await c.env.DB.prepare("UPDATE payments SET paid_at = ?, collected_by = ? WHERE id = ?")
      .bind(now, auth.user.id, row.payment_id)
      .run();

    // Optional event for COD payment collection.
    if (String(row.payment_type).toLowerCase() === "cod") {
      const latest = await c.env.DB.prepare(
        "SELECT location FROM package_events WHERE package_id = ? ORDER BY events_at DESC LIMIT 1",
      )
        .bind(packageId)
        .first<{ location: string | null }>();
      const eventId = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(eventId, packageId, "payment_collected_cod", "COD payment collected", now, latest?.location ?? null)
        .run();
    }

    return c.json({ success: true, paid_at: now });
  }
}

