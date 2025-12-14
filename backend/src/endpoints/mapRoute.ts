import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type NodeData = { id: string };
type EdgeData = { source: string; target: string; cost: number };

type HeapItem = { node: string; distance: number };

class MinHeap {
  private items: HeapItem[] = [];

  push(item: HeapItem) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  get size() {
    return this.items.length;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].distance <= this.items[index].distance) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number) {
    const n = this.items.length;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < n && this.items[left].distance < this.items[smallest].distance) smallest = left;
      if (right < n && this.items[right].distance < this.items[smallest].distance) smallest = right;

      if (smallest === index) break;
      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }
}

const computeRoute = async (
  db: D1Database,
  fromNodeId: string,
  toNodeId: string,
): Promise<{ path: string[]; totalCost: number } | null> => {
  const fromExists = await db.prepare("SELECT 1 FROM nodes WHERE id = ?").bind(fromNodeId).first();
  if (!fromExists) return null;
  const toExists = await db.prepare("SELECT 1 FROM nodes WHERE id = ?").bind(toNodeId).first();
  if (!toExists) return null;

  const nodesResult = await db.prepare("SELECT id FROM nodes").all();
  const edgesResult = await db.prepare("SELECT source, target, cost FROM edges").all();

  const nodes = (nodesResult.results || []) as NodeData[];
  const edges = (edgesResult.results || []) as EdgeData[];

  const graph: Map<string, { neighbor: string; cost: number }[]> = new Map();
  for (const node of nodes) graph.set(node.id, []);
  for (const edge of edges) {
    graph.get(edge.source)?.push({ neighbor: edge.target, cost: edge.cost });
    graph.get(edge.target)?.push({ neighbor: edge.source, cost: edge.cost });
  }

  const distances: Map<string, number> = new Map();
  const previous: Map<string, string | null> = new Map();
  const heap = new MinHeap();

  for (const node of nodes) {
    distances.set(node.id, Infinity);
    previous.set(node.id, null);
  }

  distances.set(fromNodeId, 0);
  heap.push({ node: fromNodeId, distance: 0 });

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (current.distance !== distances.get(current.node)) continue;
    if (current.node === toNodeId) break;

    const neighbors = graph.get(current.node) || [];
    for (const { neighbor, cost } of neighbors) {
      const newDist = current.distance + cost;
      if (newDist < (distances.get(neighbor) || Infinity)) {
        distances.set(neighbor, newDist);
        previous.set(neighbor, current.node);
        heap.push({ node: neighbor, distance: newDist });
      }
    }
  }

  const totalCost = distances.get(toNodeId);
  if (totalCost === undefined || totalCost === Infinity) return null;

  const path: string[] = [];
  let current: string | null = toNodeId;
  while (current !== null) {
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

    const route = await computeRoute(c.env.DB, query.from, query.to);
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

