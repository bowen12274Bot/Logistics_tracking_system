import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { getTerminalStatus, hasActiveException } from "../lib/packageGuards";

type AuthUser = { id: string; user_class: string; address: string | null };
type LatestEvent = { delivery_status: string | null; location: string | null; events_at: string | null };

function normalizeNodeId(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

async function requireWarehouse(c: AppContext) {
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

  const user = await c.env.DB.prepare("SELECT id, user_class, address FROM users WHERE id = ?")
    .bind(tokenRecord.user_id)
    .first<AuthUser>();

  if (!user || user.user_class !== "warehouse_staff") {
    return { ok: false as const, res: c.json({ error: "Forbidden" }, 403) };
  }

  const nodeId = normalizeNodeId(user.address);
  if (!nodeId) {
    return { ok: false as const, res: c.json({ error: "Warehouse has no node (users.address)" }, 400) };
  }

  return { ok: true as const, user: { ...user, address: nodeId } };
}

export class WarehousePackagesReceive extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Warehouse receive packages (batch)",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              package_ids: z.array(z.string().min(1)).min(1),
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
    },
  };

  async handle(c: AppContext) {
    const auth = await requireWarehouse(c);
    if (!auth.ok) return auth.res;
    const nodeId = auth.user.address!;

    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body as { package_ids: string[] };

    const results = {
      success: [] as string[],
      failed: [] as { id: string; reason: string }[],
    };

    const now = new Date();
    const nowIso = now.toISOString();
    const now2Iso = new Date(now.getTime() + 1).toISOString();

    for (const rawId of body.package_ids) {
      const packageId = String(rawId ?? "").trim();
      if (!packageId) {
        results.failed.push({ id: String(rawId), reason: "Missing package_id" });
        continue;
      }

      const pkg = await c.env.DB.prepare("SELECT id FROM packages WHERE id = ? LIMIT 1").bind(packageId).first();
      if (!pkg) {
        results.failed.push({ id: packageId, reason: "Package not found" });
        continue;
      }

      const terminal = await getTerminalStatus(c.env.DB, packageId);
      if (terminal) {
        results.failed.push({ id: packageId, reason: `Package is terminal (${terminal})` });
        continue;
      }
      if (await hasActiveException(c.env.DB, packageId)) {
        results.failed.push({ id: packageId, reason: "Package has active exception" });
        continue;
      }

      const latest = await c.env.DB.prepare(
        "SELECT delivery_status, location, events_at FROM package_events WHERE package_id = ? ORDER BY events_at DESC LIMIT 1",
      )
        .bind(packageId)
        .first<LatestEvent>();

      const latestStatus = String(latest?.delivery_status ?? "").trim().toLowerCase();
      const latestLoc = normalizeNodeId(latest?.location);

      // Idempotent: already received/sorting at this node
      if (latestLoc === nodeId && ["warehouse_received", "sorting", "route_decided"].includes(latestStatus)) {
        results.success.push(packageId);
        continue;
      }

      // Must arrive (warehouse_in) at this node before receiving.
      if (!(latestLoc === nodeId && latestStatus === "warehouse_in")) {
        results.failed.push({
          id: packageId,
          reason: "Package not at this warehouse (must be latest warehouse_in at this node)",
        });
        continue;
      }

      try {
        const receivedEventId = crypto.randomUUID();
        const sortingEventId = crypto.randomUUID();

        await c.env.DB.prepare(
          `
          INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
          VALUES (?, ?, 'warehouse_received', NULL, ?, ?)
          `,
        )
          .bind(receivedEventId, packageId, nowIso, nodeId)
          .run();

        await c.env.DB.prepare(
          `
          INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location)
          VALUES (?, ?, 'sorting', NULL, ?, ?)
          `,
        )
          .bind(sortingEventId, packageId, now2Iso, nodeId)
          .run();

        results.success.push(packageId);
      } catch {
        results.failed.push({ id: packageId, reason: "Insert failed" });
      }
    }

    return c.json({
      success: true,
      warehouse_node_id: nodeId,
      processed: results.success.length,
      failed: results.failed.length,
      details: results,
    });
  }
}
