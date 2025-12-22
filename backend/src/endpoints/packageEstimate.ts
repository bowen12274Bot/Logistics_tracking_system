import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import {
  calculatePackagePrice,
  type DeliveryType,
  type SpecialMark,
  type BoxType,
  ROUTE_COST_K,
  ROUTE_COST_NORM_MIN,
  ROUTE_COST_NORM_MAX,
  clamp,
  computeVolumetricWeightKg,
  determineBoxType
} from "../utils/pricing";

type NodeData = { id: string };
type EdgeData = { source: string; target: string; cost: number };


type RouteReason = "from_not_found" | "to_not_found" | "no_route";

type RouteResult =
  | { ok: true; path: string[]; totalCost: number }
  | {
      ok: false;
      reason: RouteReason;
      debug?: { nodesCount: number; edgesCount: number; fromDegree: number; toDegree: number };
    };

const computeRoute = async (
  db: D1Database,
  fromNodeId: string,
  toNodeId: string,
): Promise<RouteResult> => {
  const fromId = String(fromNodeId).trim();
  const toId = String(toNodeId).trim();

  const fromExists = await db.prepare("SELECT 1 FROM nodes WHERE id = ?").bind(fromId).first();
  if (!fromExists) return { ok: false, reason: "from_not_found" };
  const toExists = await db.prepare("SELECT 1 FROM nodes WHERE id = ?").bind(toId).first();
  if (!toExists) return { ok: false, reason: "to_not_found" };

  const nodesResult = await db.prepare("SELECT id FROM nodes").all();
  const edgesResult = await db.prepare("SELECT source, target, cost FROM edges").all();

  const nodes = (nodesResult.results || []) as NodeData[];
  const edges = (edgesResult.results || []) as EdgeData[];

  const graph: Map<string, { neighbor: string; cost: number }[]> = new Map();
  for (const node of nodes) graph.set(String(node.id).trim(), []);
  if (!graph.has(fromId)) graph.set(fromId, []);
  if (!graph.has(toId)) graph.set(toId, []);

  let usedEdges = 0;
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
    usedEdges += 1;
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
  if (totalCost === undefined || totalCost === Infinity) {
    return {
      ok: false,
      reason: "no_route",
      debug: {
        nodesCount: graph.size,
        edgesCount: usedEdges,
        fromDegree: graph.get(fromId)?.length ?? 0,
        toDegree: graph.get(toId)?.length ?? 0,
      },
    };
  }

  const path: string[] = [];
  let current: string | null = toId;
  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) || null;
  }

  return { ok: true, path, totalCost };
};

// POST /api/packages/estimate - 運費試算（公開 API）
export class PackageEstimate extends OpenAPIRoute {
  schema = {
    tags: ["Package"],
    summary: "運費試算",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              fromNodeId: z.string(),
              toNodeId: z.string(),
              weightKg: z.number().positive(),
              dimensionsCm: z.object({
                length: z.number().positive(),
                width: z.number().positive(),
                height: z.number().positive(),
              }),
              deliveryType: z.enum(["overnight", "two_day", "standard", "economy"]),
              specialMarks: z.array(z.enum(["fragile", "dangerous", "international"])).optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "OK",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              estimate: z.object({
                fromNodeId: z.string(),
                toNodeId: z.string(),
                route_cost: z.number(),
                route_path: z.array(z.string()),
                route_cost_norm: z.number(),
                box_type: z.enum(["envelope", "S", "M", "L"]),
                service_multiplier: z.number(),
                base: z.number(),
                shipping: z.number(),
                weight_surcharge: z.number(),
                international_multiplier_applied: z.number(),
                mark_fee: z.number(),
                calculated_price: z.number(),
                min_price: z.number(),
                max_price: z.number(),
                total_cost: z.number(),
                estimated_delivery_date: z.string(),
              }),
            }),
          },
        },
      },
      "400": { description: "Bad Request" },
      "404": { description: "Route Not Found" },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json<{
      fromNodeId: string;
      toNodeId: string;
      weightKg: number;
      dimensionsCm: { length: number; width: number; height: number };
      deliveryType: DeliveryType;
      specialMarks?: SpecialMark[];
    }>();

    const specialMarks = body.specialMarks ?? [];

    const fromNodeId = String(body.fromNodeId).trim();
    const toNodeId = String(body.toNodeId).trim();

    const route = await computeRoute(c.env.DB, fromNodeId, toNodeId);
    if (route.ok === false) {
      const reasonMessage: Record<RouteReason, string> = {
        from_not_found: "From node not found",
        to_not_found: "To node not found",
        no_route: "No route between nodes",
      };
      const errorBody: {
        error: string;
        reason: RouteReason;
        from: string;
        to: string;
        debug?: { nodesCount: number; edgesCount: number; fromDegree: number; toDegree: number };
      } = { error: reasonMessage[route.reason], reason: route.reason, from: fromNodeId, to: toNodeId };
      if (route.reason === "no_route" && route.debug) errorBody.debug = route.debug;
      return c.json(
        errorBody,
        404,
      );
    }

    const pricing = calculatePackagePrice(
      route.totalCost,
      body.weightKg,
      body.dimensionsCm,
      body.deliveryType,
      specialMarks
    );

    if ("error" in pricing) {
      return c.json({ error: pricing.error }, 400);
    }

    return c.json({
      success: true,
      estimate: {
        fromNodeId,
        toNodeId,
        route_cost: pricing.routeCost,
        route_path: route.path,
        route_cost_norm: pricing.routeCostNorm,
        box_type: pricing.boxType,
        service_multiplier: pricing.serviceMultiplier,
        base: pricing.base,
        shipping: pricing.shipping,
        weight_surcharge: pricing.weightSurcharge,
        international_multiplier_applied: pricing.internationalMultiplierApplied,
        mark_fee: pricing.markFee,
        calculated_price: pricing.calculatedPrice,
        min_price: pricing.minPrice,
        max_price: pricing.maxPrice,
        total_cost: pricing.totalCost,
        estimated_delivery_date: pricing.estimatedDeliveryDate,
      },
    });
  }
}
