import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type NodeData = { id: string };
type EdgeData = { source: string; target: string; cost: number };

type RouteReason = "from_not_found" | "to_not_found" | "no_route";

export type RouteResult =
  | { ok: true; path: string[]; totalCost: number }
  | {
      ok: false;
      reason: RouteReason;
      debug?: { nodesCount: number; edgesCount: number; fromDegree: number; toDegree: number };
    };

import { buildGraph, computeShortestPath, type EdgeRow, type NodeRow } from "../utils/graphUtils";

export const computeRoute = async (
  db: D1Database,
  fromNodeId: string,
  toNodeId: string,
): Promise<RouteResult> => {
  const nodesResult = await db.prepare("SELECT id FROM nodes").all();
  const edgesResult = await db.prepare("SELECT source, target, cost FROM edges").all();

  const nodes = (nodesResult.results || []) as NodeRow[];
  const edges = (edgesResult.results || []) as EdgeRow[];

  const graph = buildGraph(nodes, edges);
  
  const result = computeShortestPath(graph, fromNodeId, toNodeId);

  if (!result) {
    const start = String(fromNodeId).trim().toUpperCase();
    const end = String(toNodeId).trim().toUpperCase();
    if (!graph.nodeIds.has(start)) return { ok: false, reason: "from_not_found" };
    if (!graph.nodeIds.has(end)) return { ok: false, reason: "to_not_found" };

    return {
      ok: false,
      reason: "no_route",
      debug: { 
        nodesCount: nodes.length, 
        edgesCount: edges.length, 
        fromDegree: (graph.adj.get(start)?.length || 0), 
        toDegree: (graph.adj.get(end)?.length || 0) 
      },
    };
  }

  return { ok: true, path: result.path, totalCost: result.cost };
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
    if (route.ok === false) {
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
