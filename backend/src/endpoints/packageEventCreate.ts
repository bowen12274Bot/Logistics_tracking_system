import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";
import { requireAuth } from "../utils/authUtils";

const DeliveryStatusEnum = z.enum([
  "created",
  "picked_up",
  "in_transit",
  "sorting",
  "warehouse_in",
  "warehouse_received",
  "warehouse_out",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "exception",
  "exception_resolved",
  "route_decided",
  "sorting_started",
  "sorting_completed",
  "enroute_pickup",
  "arrived_pickup",
  "payment_collected_prepaid",
  "enroute_delivery",
  "arrived_delivery",
  "payment_collected_cod",
]);

export class PackageEventCreate extends OpenAPIRoute {
  schema = {
    tags: ["Packages"],
    summary: "Create package event (T3)",
    description: "Create a package event (employee-only).",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({
        packageId: Str({ description: "Package ID" }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              delivery_status: DeliveryStatusEnum.describe("Event status"),
              delivery_details: Str({ required: false, description: "Event details" }),
              location: Str({ required: false, description: "Location (node id / vehicle code)" }),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "OK" },
      "400": { description: "Bad request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAuth(c);
    if (auth.ok === false) return (auth as any).res;
    if (auth.user.user_type !== "employee") return c.json({ success: false, error: "Forbidden" }, 403);

    const data = await this.getValidatedData<typeof this.schema>();
    const { packageId } = data.params;
    const { delivery_status, delivery_details, location } = data.body;

    if (delivery_status === "exception") {
      return c.json(
        {
          success: false,
          error:
            "Use /api/driver/packages/:packageId/exception or /api/warehouse/packages/:packageId/exception instead of manual exception events.",
        },
        400,
      );
    }
    if (delivery_status === "exception_resolved") {
      return c.json({ success: false, error: "Use /api/cs/exceptions/:exceptionId/handle instead." }, 400);
    }
    if (delivery_status === "delivery_failed") {
      return c.json({ success: false, error: "Use /api/cs/exceptions/:exceptionId/handle (cancel) instead." }, 400);
    }

    if (delivery_status === "in_transit") {
      const details = String(delivery_details ?? "").trim();
      const ok = /(destination|dest|目的地)\s*[:：]?\s*[A-Z0-9_]+/i.test(details);
      if (!ok) return c.json({ success: false, error: "in_transit requires delivery_details containing destination" }, 400);
    }

    const pkg = await c.env.DB.prepare("SELECT 1 AS ok FROM packages WHERE id = ? LIMIT 1").bind(packageId).first();
    if (!pkg) return c.json({ success: false, error: "Package not found" }, 404);

    const terminal = await getTerminalStatus(c.env.DB, packageId);
    if (terminal) return c.json({ success: false, error: "Package is terminal", status: terminal }, 409);
    if (await hasActiveException(c.env.DB, packageId)) return c.json({ success: false, error: "Package has active exception" }, 409);

    const eventId = crypto.randomUUID();
    const eventsAt = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(eventId, packageId, delivery_status, delivery_details ?? null, eventsAt, location ?? null)
      .run();

    return c.json({ success: true, event_id: eventId, message: "Event created" });
  }
}

