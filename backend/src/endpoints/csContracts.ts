import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AuthUser = { id: string; user_class: string };

async function requireCustomerService(c: AppContext) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false as const, res: c.json({ error: "Token missing" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
    .bind(token)
    .first<{ user_id: string }>();
  if (!tokenRecord) return { ok: false as const, res: c.json({ error: "Invalid token" }, 401) };

  const user = await c.env.DB.prepare("SELECT id, user_class FROM users WHERE id = ?")
    .bind(tokenRecord.user_id)
    .first<AuthUser>();
  if (!user || user.user_class !== "customer_service") {
    return { ok: false as const, res: c.json({ error: "Forbidden" }, 403) };
  }

  return { ok: true as const, user };
}

// GET /api/cs/contract-applications - list contract applications (CS task list)
export class CustomerServiceContractList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Customer service contract applications list",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
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
    const auth = await requireCustomerService(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const status = data.query.status;
    const limit = data.query.limit;

    const where: string[] = ["1=1"];
    const params: any[] = [];
    if (status) {
      where.push("ca.status = ?");
      params.push(status);
    }

    const rows = await c.env.DB.prepare(
      `
      SELECT ca.*, u.user_name as customer_name, u.email as customer_email
      FROM contract_applications ca
      LEFT JOIN users u ON ca.customer_id = u.id
      WHERE ${where.join(" AND ")}
      ORDER BY ca.created_at DESC
      LIMIT ?
      `,
    )
      .bind(...params, limit)
      .all();

    return c.json({
      success: true,
      applications: (rows.results || []).map((app: any) => ({
        id: app.id,
        customer: {
          id: app.customer_id,
          name: app.customer_name,
          email: app.customer_email,
        },
        company_name: app.company_name,
        tax_id: app.tax_id,
        contact_person: app.contact_person,
        contact_phone: app.contact_phone,
        billing_address: app.billing_address,
        notes: app.notes,
        status: app.status,
        reviewed_by: app.reviewed_by ?? null,
        reviewed_at: app.reviewed_at ?? null,
        review_notes: app.review_notes ?? null,
        credit_limit: app.credit_limit ?? null,
        created_at: app.created_at,
      })),
    });
  }
}

// PUT /api/cs/contract-applications/:id - review a pending contract application
export class CustomerServiceContractReview extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Customer service review contract application",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        id: z.string().min(1),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              status: z.enum(["approved", "rejected"]),
              credit_limit: z.number().int().optional(),
              review_notes: z.string().optional(),
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
    const auth = await requireCustomerService(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const id = String(data.params.id).trim();
    const body = data.body as { status: "approved" | "rejected"; credit_limit?: number; review_notes?: string };

    const application = await c.env.DB.prepare(
      "SELECT id, customer_id, status FROM contract_applications WHERE id = ? LIMIT 1",
    )
      .bind(id)
      .first<{ id: string; customer_id: string; status: string }>();
    if (!application) return c.json({ error: "申請不存在" }, 404);
    if (String(application.status) !== "pending") return c.json({ error: "此申請已審核過" }, 400);

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `
      UPDATE contract_applications
      SET status = ?, reviewed_by = ?, reviewed_at = ?, credit_limit = ?, review_notes = ?
      WHERE id = ?
      `,
    )
      .bind(body.status, auth.user.id, now, body.credit_limit ?? null, body.review_notes ?? null, id)
      .run();

    if (body.status === "approved") {
      await c.env.DB.prepare("UPDATE users SET user_class = 'contract_customer', billing_preference = 'monthly' WHERE id = ?")
        .bind(application.customer_id)
        .run();
    }

    return c.json({
      success: true,
      application_id: id,
      status: body.status,
      message: body.status === "approved" ? "申請已核准" : "申請已拒絕",
    });
  }
}

