import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireWarehouse, type AuthUser } from "../utils/authUtils";

type PackageRow = {
  id: string;
  tracking_number: string | null;
  sender_address: string | null;
  receiver_address: string | null;
  delivery_time: string | null;
  estimated_delivery: string | null;
  payment_type: string | null;
  route_path: string | null;
  last_status: string | null;
  last_details: string | null;
  last_at: string | null;
  last_location: string | null;
};

type NodeRow = { id: string };
type EdgeRow = { source: string; target: string; cost: number };

function normalizeNodeId(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

async function requireWarehouseWithNode(c: AppContext) {
  const auth = await requireWarehouse(c);
  if (auth.ok === false) return auth;

  const nodeId = normalizeNodeId(auth.user.address);
  if (!nodeId) {
    return { ok: false as const, res: c.json({ error: "Warehouse has no node (users.address)" }, 400) };
  }

  return { ok: true as const, user: { ...auth.user, address: nodeId } };
}

function buildGraph(nodes: NodeRow[], edges: EdgeRow[]) {
  const nodeIds = new Set(nodes.map((n) => normalizeNodeId(n.id)).filter(Boolean));
  const adj = new Map<string, Array<{ to: string; cost: number }>>();

  const add = (a: string, b: string, cost: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, cost });
  };

  for (const e of edges) {
    const a = normalizeNodeId(e.source);
    const b = normalizeNodeId(e.target);
    const cost = Number((e as any).cost);
    if (!a || !b || !Number.isFinite(cost)) continue;
    add(a, b, cost);
    add(b, a, cost);
  }

  return { nodeIds, adj };
}

function dijkstraCost(
  graph: { nodeIds: Set<string>; adj: Map<string, Array<{ to: string; cost: number }>> },
  from: string,
  to: string,
) {
  const start = normalizeNodeId(from);
  const goal = normalizeNodeId(to);
  if (!start || !goal) return null;
  if (!graph.nodeIds.has(start) || !graph.nodeIds.has(goal)) return null;
  if (start === goal) return 0;

  const dist = new Map<string, number>();
  const visited = new Set<string>();
  const pq: Array<{ node: string; d: number }> = [{ node: start, d: 0 }];
  dist.set(start, 0);

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift()!;
    if (visited.has(cur.node)) continue;
    visited.add(cur.node);
    if (cur.node === goal) return cur.d;

    for (const nxt of graph.adj.get(cur.node) ?? []) {
      if (visited.has(nxt.to)) continue;
      const nd = cur.d + nxt.cost;
      const best = dist.get(nxt.to);
      if (best === undefined || nd < best) {
        dist.set(nxt.to, nd);
        pq.push({ node: nxt.to, d: nd });
      }
    }
  }

  return null;
}

export class WarehousePackagesList extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "List packages currently at my warehouse node",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(500).optional(),
      }),
    },
    responses: {
      "200": { description: "OK" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireWarehouseWithNode(c);
    if (auth.ok === false) return (auth as any).res;
    const nodeId = auth.user.address!;

    const data = await this.getValidatedData<typeof this.schema>();
    const limit = Number(data.query.limit ?? 200);

    const latestRows = await c.env.DB.prepare(
      `
      WITH latest AS (
        SELECT pe.package_id, pe.delivery_status, pe.delivery_details, pe.events_at, pe.location
        FROM package_events pe
        JOIN (
          SELECT package_id, MAX(events_at) AS max_at
          FROM package_events
          WHERE events_at IS NOT NULL
          GROUP BY package_id
        ) m
          ON m.package_id = pe.package_id AND m.max_at = pe.events_at
      )
      SELECT
        p.id AS id,
        p.tracking_number AS tracking_number,
        p.sender_address AS sender_address,
        p.receiver_address AS receiver_address,
        p.delivery_time AS delivery_time,
        p.estimated_delivery AS estimated_delivery,
        p.payment_type AS payment_type,
        p.route_path AS route_path,
        latest.delivery_status AS last_status,
        latest.delivery_details AS last_details,
        latest.events_at AS last_at,
        latest.location AS last_location
      FROM packages p
      JOIN latest ON latest.package_id = p.id
      WHERE UPPER(TRIM(latest.location)) = ?
        AND LOWER(TRIM(latest.delivery_status)) IN ('warehouse_in','warehouse_received','sorting','route_decided')
      ORDER BY latest.events_at DESC
      LIMIT ?
      `,
    )
      .bind(nodeId, limit)
      .all();

    const packages = (latestRows.results || []) as unknown as PackageRow[];

    const edgesRes = await c.env.DB.prepare(
      "SELECT source, target, cost FROM edges WHERE UPPER(source) = ? OR UPPER(target) = ?",
    )
      .bind(nodeId, nodeId)
      .all();
    const neighborSet = new Set<string>();
    for (const e of (edgesRes.results || []) as any[]) {
      const a = normalizeNodeId(e.source);
      const b = normalizeNodeId(e.target);
      if (a === nodeId && b) neighborSet.add(b);
      if (b === nodeId && a) neighborSet.add(a);
    }
    const neighbors = Array.from(neighborSet.values()).sort();

    const nodesRes = await c.env.DB.prepare("SELECT id FROM nodes").all();
    const allEdgesRes = await c.env.DB.prepare("SELECT source, target, cost FROM edges").all();
    const graph = buildGraph((nodesRes.results || []) as NodeRow[], (allEdgesRes.results || []) as EdgeRow[]);

    const rows = packages.map((p) => {
      const lastStatus = String(p.last_status ?? "").trim().toLowerCase();
      const receiverNodeId = normalizeNodeId(p.receiver_address);

      let ui_state: "await_receive" | "sorting" | "dispatched" = "sorting";
      if (lastStatus === "warehouse_in") ui_state = "await_receive";
      if (lastStatus === "route_decided") ui_state = "dispatched";

      let suggested_to_node_id: string | null = null;
      let suggested_total_cost: number | null = null;
      if (receiverNodeId && graph.nodeIds.has(receiverNodeId) && neighbors.length > 0) {
        for (const candidate of neighbors) {
          const cost = dijkstraCost(graph, candidate, receiverNodeId);
          if (cost === null) continue;
          if (suggested_total_cost === null || cost < suggested_total_cost) {
            suggested_total_cost = cost;
            suggested_to_node_id = candidate;
          }
        }
      }

      return {
        id: p.id,
        tracking_number: p.tracking_number,
        sender_address: p.sender_address,
        receiver_address: p.receiver_address,
        delivery_time: p.delivery_time,
        estimated_delivery: p.estimated_delivery,
        payment_type: p.payment_type,
        route_path: p.route_path,
        latest_event: {
          delivery_status: p.last_status,
          delivery_details: p.last_details,
          events_at: p.last_at,
          location: p.last_location,
        },
        ui_state,
        suggested_to_node_id,
        suggested_total_cost,
      };
    });

    return c.json({ success: true, warehouse_node_id: nodeId, neighbors, packages: rows });
  }
}

