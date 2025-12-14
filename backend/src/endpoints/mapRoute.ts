import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

interface NodeData {
  id: string;
  x: number;
  y: number;
}

interface EdgeData {
  source: string;
  target: string;
  cost: number;
}

// GET /api/map/route - 路線成本計算 (Dijkstra)
export class MapRoute extends OpenAPIRoute {
  schema = {
    tags: ["Map"],
    summary: "計算兩點之間的路線成本",
    request: {
      query: z.object({
        from: z.string(),
        to: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "計算成功",
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
      "400": {
        description: "缺少 from 或 to 參數",
      },
      "404": {
        description: "起點或終點節點不存在",
      },
    },
  };

  async handle(c: AppContext) {
    const query = c.req.query();

    if (!query.from || !query.to) {
      return c.json({ error: "缺少 from 或 to 參數" }, 400);
    }

    const fromNode = query.from;
    const toNode = query.to;

    // 檢查節點是否存在
    const fromExists = await c.env.DB.prepare(
      "SELECT id FROM nodes WHERE id = ?"
    ).bind(fromNode).first();

    const toExists = await c.env.DB.prepare(
      "SELECT id FROM nodes WHERE id = ?"
    ).bind(toNode).first();

    if (!fromExists) {
      return c.json({ error: `起點節點 ${fromNode} 不存在` }, 404);
    }

    if (!toExists) {
      return c.json({ error: `終點節點 ${toNode} 不存在` }, 404);
    }

    // 取得所有節點和邊
    const nodesResult = await c.env.DB.prepare("SELECT id, x, y FROM nodes").all();
    const edgesResult = await c.env.DB.prepare("SELECT source, target, cost FROM edges").all();

    const nodes = (nodesResult.results || []) as NodeData[];
    const edges = (edgesResult.results || []) as EdgeData[];

    // 建立鄰接表
    const graph: Map<string, { neighbor: string; cost: number }[]> = new Map();
    
    for (const node of nodes) {
      graph.set(node.id, []);
    }

    for (const edge of edges) {
      // 雙向邊
      graph.get(edge.source)?.push({ neighbor: edge.target, cost: edge.cost });
      graph.get(edge.target)?.push({ neighbor: edge.source, cost: edge.cost });
    }

    // Dijkstra 演算法
    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();
    const pq: { node: string; distance: number }[] = [];

    for (const node of nodes) {
      distances.set(node.id, Infinity);
      previous.set(node.id, null);
    }

    distances.set(fromNode, 0);
    pq.push({ node: fromNode, distance: 0 });

    while (pq.length > 0) {
      // 簡單排序取最小（實際應用可用 heap）
      pq.sort((a, b) => a.distance - b.distance);
      const current = pq.shift()!;

      if (visited.has(current.node)) continue;
      visited.add(current.node);

      if (current.node === toNode) break;

      const neighbors = graph.get(current.node) || [];
      for (const { neighbor, cost } of neighbors) {
        if (visited.has(neighbor)) continue;

        const newDist = (distances.get(current.node) || Infinity) + cost;
        if (newDist < (distances.get(neighbor) || Infinity)) {
          distances.set(neighbor, newDist);
          previous.set(neighbor, current.node);
          pq.push({ node: neighbor, distance: newDist });
        }
      }
    }

    // 重建路徑
    const path: string[] = [];
    let current: string | null = toNode;
    
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) || null;
    }

    const totalCost = distances.get(toNode);

    if (totalCost === Infinity) {
      return c.json({ 
        error: "無法找到從起點到終點的路線",
        from: fromNode,
        to: toNode,
      }, 404);
    }

    return c.json({
      success: true,
      route: {
        from: fromNode,
        to: toNode,
        path,
        total_cost: totalCost,
      },
    });
  }
}
