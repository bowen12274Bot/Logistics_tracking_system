import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type NodeData = { id: string };
type EdgeData = { source: string; target: string; cost: number };

export const computeRoute = async (
  db: D1Database,
  fromNodeId: string,
  toNodeId: string,
): Promise<{ path: string[]; totalCost: number } | null> => {
  const fromId = String(fromNodeId).trim();
  const toId = String(toNodeId).trim();

  const fromExists = await db.prepare("SELECT 1 FROM nodes WHERE id = ?").bind(fromId).first();
  if (!fromExists) return null;
  const toExists = await db.prepare("SELECT 1 FROM nodes WHERE id = ?").bind(toId).first();
  if (!toExists) return null;

  const nodesResult = await db.prepare("SELECT id FROM nodes").all();
  const edgesResult = await db.prepare("SELECT source, target, cost FROM edges").all();

  const nodes = (nodesResult.results || []) as NodeData[];
  const edges = (edgesResult.results || []) as EdgeData[];

  const graph: Map<string, { neighbor: string; cost: number }[]> = new Map();
  for (const node of nodes) graph.set(String(node.id).trim(), []);
  if (!graph.has(fromId)) graph.set(fromId, []);
  if (!graph.has(toId)) graph.set(toId, []);

  for (const edge of edges) {
    const cost = Number((edge as any).cost);
    if (!Number.isFinite(cost)) continue;

    const source = String(edge.source).trim();
    const target = String(edge.target).trim();
    if (!source || !target) continue;

    if (!graph.has(source)) graph.set(source, []);
    if (!graph.has(target)) graph.set(target, []);

    graph.get(source)?.push({ neighbor: target, cost });
    graph.get(target)?.push({ neighbor: source, cost });
  }

  const distances: Map<string, number> = new Map();
  const previous: Map<string, string | null> = new Map();
  const visited: Set<string> = new Set();
  const pq: { node: string; distance: number }[] = [];

  for (const node of nodes) {
    const id = String(node.id).trim();
    distances.set(id, Infinity);
    previous.set(id, null);
  }

  distances.set(fromId, 0);
  pq.push({ node: fromId, distance: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.distance - b.distance);
    const current = pq.shift()!;
    if (visited.has(current.node)) continue;
    visited.add(current.node);
    if (current.node === toId) break;

    const neighbors = graph.get(current.node) || [];
    for (const { neighbor, cost } of neighbors) {
      if (visited.has(neighbor)) continue;
      const currentDist = distances.get(current.node);
      const newDist = (currentDist ?? Infinity) + cost;
      if (newDist < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, newDist);
        previous.set(neighbor, current.node);
        pq.push({ node: neighbor, distance: newDist });
      }
    }
  }

  const totalCost = distances.get(toId);
  if (totalCost === undefined || totalCost === Infinity) return null;

  const path: string[] = [];
  let current: string | null = toId;
  const seen = new Set<string>();
  while (current !== null) {
    if (seen.has(current)) return null;
    seen.add(current);
    path.unshift(current);
    current = previous.get(current) || null;
  }

  return { path, totalCost };
};

// GET /api/map/route - shortest path cost (Dijkstra)
export class MapRoute extends OpenAPIRoute {
  schema = {
    tags: ["Map"],
    summary: "Compute shortest route cost",
    request: {
      query: z.object({
        from: z.string(),
        to: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              route: z.object({
                from: z.string(),
                to: z.string(),
                path: z.array(z.string()),
                total_cost: z.number(),
              }),
            }),
          },
        },
      },
      "400": { description: "Missing from/to" },
      "404": { description: "Node or route not found" },
    },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    if (!query.from || !query.to) return c.json({ error: "Missing from/to" }, 400);

    const route = await computeRoute(c.env.DB, String(query.from).trim(), String(query.to).trim());
    if (!route) {
      return c.json({ error: "Route not found", from: query.from, to: query.to }, 404);
    }

    return c.json({
      success: true,
      route: {
        from: query.from,
        to: query.to,
        path: route.path,
        total_cost: route.totalCost,
      },
    });
  }
}
