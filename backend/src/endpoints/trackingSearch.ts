import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireRole } from "../utils/authUtils";

// GET /api/tracking/search - 進階搜尋（員工用）
export class TrackingSearch extends OpenAPIRoute {
  schema = {
    tags: ["Tracking"],
    summary: "進階追蹤搜尋（員工用）",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        tracking_number: z.string().optional(),
        customer_id: z.string().optional(),
        customer_account: z.string().optional(),
        date_from: z.string().optional(),
        date_to: z.string().optional(),
        location_id: z.string().optional(),
        vehicle_id: z.string().optional(),
        status_group: z.enum(["in_transit", "history"]).optional(),
        status: z.string().optional(),
        exception_only: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "搜尋成功",
      },
      "401": {
        description: "未認證",
      },
      "403": {
        description: "權限不足",
      },
    },
  };

  async handle(c: AppContext) {
    const allowedRoles = ["customer_service", "warehouse_staff", "admin", "customer"];
    const auth = await requireRole(c, allowedRoles);
    if (!auth.ok) return (auth as any).res;

    const isCustomer = auth.user.user_type === "customer";

    const query = c.req.query();

    const normalizeDateBoundary = (value: string | undefined, boundary: "start" | "end") => {
      if (!value) return undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return boundary === "start" ? `${value}T00:00:00Z` : `${value}T23:59:59Z`;
      }
      return value;
    };

    const dateFrom = normalizeDateBoundary(query.date_from, "start");
    const dateTo = normalizeDateBoundary(query.date_to, "end");

    if (
      query.location_id &&
      query.vehicle_id &&
      query.location_id.trim() !== "" &&
      query.vehicle_id.trim() !== "" &&
      query.location_id !== query.vehicle_id
    ) {
      return c.json({ error: "location_id and vehicle_id cannot be used together" }, 400);
    }

    let effectiveCustomerId: string | undefined = undefined;
    if (isCustomer) {
      effectiveCustomerId = auth.user.id;
    } else {
      if (query.customer_id) {
        effectiveCustomerId = query.customer_id;
      } else if (query.customer_account) {
        const account = query.customer_account.trim();
        const found = await c.env.DB.prepare(
          account.includes("@")
            ? "SELECT id FROM users WHERE email = ? AND user_type = 'customer'"
            : "SELECT id FROM users WHERE id = ? AND user_type = 'customer'"
        )
          .bind(account)
          .first<{ id: string }>();
        if (!found) {
          return c.json({ error: "Customer not found" }, 404);
        }
        effectiveCustomerId = found.id;
      }
    }

    // 建立查詢條件
    let sql = `
      SELECT p.id, p.tracking_number, p.status, p.customer_id, p.created_at,
             p.sender_name, p.receiver_name, p.estimated_delivery, p.delivery_time, p.route_path,
             (
               SELECT location
               FROM package_events pe
               WHERE pe.package_id = p.id
               ORDER BY pe.events_at DESC
               LIMIT 1
             ) AS current_location,
             (
               SELECT events_at
               FROM package_events pe
               WHERE pe.package_id = p.id
               ORDER BY pe.events_at DESC
               LIMIT 1
             ) AS current_updated_at
      FROM packages p
      WHERE 1=1
    `;
    const params: string[] = [];

    if (query.tracking_number) {
      sql += " AND p.tracking_number LIKE ?";
      params.push(`%${query.tracking_number}%`);
    }

    if (effectiveCustomerId) {
      sql += " AND p.customer_id = ?";
      params.push(effectiveCustomerId);
    }

    if (dateFrom) {
      sql += " AND p.created_at >= ?";
      params.push(dateFrom);
    }

    if (dateTo) {
      sql += " AND p.created_at <= ?";
      params.push(dateTo);
    }

    if (query.status) {
      sql += " AND p.status = ?";
      params.push(query.status);
    }

    if (query.exception_only === "true") {
      sql += " AND p.status = 'exception'";
    }

    // status_group semantics:
    // - history: completed deliveries only
    // - in_transit: everything not completed (including exception, which still needs follow-up)
    if (query.status_group === "history") {
      sql += " AND p.status IN ('delivered','delivery_failed')";
    } else if (query.status_group === "in_transit") {
      sql += " AND (p.status IS NULL OR p.status NOT IN ('delivered','delivery_failed'))";
    }

    if (query.location_id) {
      sql +=
        " AND (SELECT location FROM package_events pe WHERE pe.package_id = p.id ORDER BY pe.events_at DESC LIMIT 1) = ?";
      params.push(query.location_id);
    }

    if (query.vehicle_id && !query.location_id) {
      sql +=
        " AND (SELECT location FROM package_events pe WHERE pe.package_id = p.id ORDER BY pe.events_at DESC LIMIT 1) LIKE ?";
      params.push(`%${query.vehicle_id}%`);
    }

    sql += " ORDER BY p.created_at DESC LIMIT 100";

    const stmt = c.env.DB.prepare(sql);
    const result = params.length > 0 
      ? await stmt.bind(...params).all()
      : await stmt.all();

    const packages = result.results || [];

    return c.json({
      success: true,
      packages,
      total: packages.length,
    });
  }
}
