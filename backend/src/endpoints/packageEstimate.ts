import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type DeliveryType = "overnight" | "two_day" | "standard" | "economy";
type SpecialMark = "fragile" | "dangerous" | "international";
type BoxType = "envelope" | "S" | "M" | "L";

type NodeData = { id: string };
type EdgeData = { source: string; target: string; cost: number };

const ROUTE_COST_K = 5200;
const ROUTE_COST_NORM_MIN = 0.3;
const ROUTE_COST_NORM_MAX = 1.6;

const INTERNATIONAL_MULTIPLIER = 1.8;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const ceilInt = (value: number) => Math.ceil(value);

const getServiceMultiplier = (deliveryType: DeliveryType) => {
  const multipliers: Record<DeliveryType, number> = {
    economy: 1.0,
    standard: 1.25,
    two_day: 1.55,
    overnight: 2.0,
  };
  return multipliers[deliveryType];
};

const getDeliveryDays = (deliveryType: DeliveryType) => {
  const days: Record<DeliveryType, number> = {
    overnight: 1,
    two_day: 2,
    standard: 3,
    economy: 5,
  };
  return days[deliveryType];
};

const getBaseParams = (boxType: BoxType) => {
  const params: Record<BoxType, { baseFee: number; ratePerCost: number }> = {
    envelope: { baseFee: 30, ratePerCost: 90 },
    S: { baseFee: 70, ratePerCost: 170 },
    M: { baseFee: 110, ratePerCost: 260 },
    L: { baseFee: 160, ratePerCost: 380 },
  };
  return params[boxType];
};

const getWeightSurchargeParams = (boxType: BoxType) => {
  const params: Record<BoxType, { includedWeightKg: number; perKgFee: number }> = {
    envelope: { includedWeightKg: 0.5, perKgFee: 0 },
    S: { includedWeightKg: 3, perKgFee: 18 },
    M: { includedWeightKg: 10, perKgFee: 15 },
    L: { includedWeightKg: 25, perKgFee: 12 },
  };
  return params[boxType];
};

const getMinPrice = (boxType: BoxType, deliveryType: DeliveryType) => {
  const table: Record<BoxType, Record<DeliveryType, number>> = {
    envelope: { economy: 50, standard: 70, two_day: 90, overnight: 120 },
    S: { economy: 120, standard: 160, two_day: 210, overnight: 280 },
    M: { economy: 200, standard: 260, two_day: 340, overnight: 450 },
    L: { economy: 320, standard: 420, two_day: 550, overnight: 750 },
  };
  return table[boxType][deliveryType];
};

const getMaxPrice = (boxType: BoxType, deliveryType: DeliveryType) => {
  const table: Record<BoxType, Record<DeliveryType, number>> = {
    envelope: { economy: 400, standard: 550, two_day: 700, overnight: 950 },
    S: { economy: 900, standard: 1200, two_day: 1500, overnight: 1900 },
    M: { economy: 1400, standard: 1850, two_day: 2350, overnight: 2900 },
    L: { economy: 2200, standard: 2900, two_day: 3700, overnight: 4600 },
  };
  return table[boxType][deliveryType];
};

const computeVolumetricWeightKg = (lengthCm: number, widthCm: number, heightCm: number) =>
  (lengthCm * widthCm * heightCm) / 6000;

const determineBoxType = (
  lengthCm: number,
  widthCm: number,
  heightCm: number,
  billableWeightKg: number,
): BoxType | null => {
  const dims = [lengthCm, widthCm, heightCm].sort((a, b) => b - a);
  const [d1, d2, d3] = dims;
  const thickness = d3;

  if (d1 <= 30 && thickness <= 2 && billableWeightKg <= 0.5) return "envelope";
  if (d1 <= 40 && d2 <= 30 && d3 <= 20 && billableWeightKg <= 5) return "S";
  if (d1 <= 60 && d2 <= 40 && d3 <= 40 && billableWeightKg <= 20) return "M";
  if (d1 <= 90 && d2 <= 60 && d3 <= 60 && billableWeightKg <= 50) return "L";
  return null;
};

const computeMarkFee = (specialMarks: SpecialMark[]) => {
  let markFee = 0;
  if (specialMarks.includes("dangerous")) markFee += 120;
  if (specialMarks.includes("fragile")) markFee += 60;
  return markFee;
};

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

    const routeCost = route.totalCost;
    const routeCostNormRaw = routeCost / ROUTE_COST_K;
    const routeCostNorm = clamp(routeCostNormRaw, ROUTE_COST_NORM_MIN, ROUTE_COST_NORM_MAX);

    const volumetricWeightKg = computeVolumetricWeightKg(
      body.dimensionsCm.length,
      body.dimensionsCm.width,
      body.dimensionsCm.height,
    );
    const billableWeightKg = Math.max(body.weightKg, volumetricWeightKg);

    const boxType = determineBoxType(
      body.dimensionsCm.length,
      body.dimensionsCm.width,
      body.dimensionsCm.height,
      billableWeightKg,
    );
    if (!boxType) return c.json({ error: "Oversized package" }, 400);

    const serviceMultiplier = getServiceMultiplier(body.deliveryType);
    const { baseFee, ratePerCost } = getBaseParams(boxType);
    const base = baseFee + routeCostNorm * ratePerCost;
    const shipping = ceilInt(base * serviceMultiplier);

    const { includedWeightKg, perKgFee } = getWeightSurchargeParams(boxType);
    const extraKg = Math.max(0, ceilInt(billableWeightKg - includedWeightKg));
    const weightSurcharge = extraKg * perKgFee;

    let subtotal = shipping + weightSurcharge;
    const internationalMultiplierApplied = specialMarks.includes("international")
      ? INTERNATIONAL_MULTIPLIER
      : 1;
    if (internationalMultiplierApplied !== 1) {
      subtotal = ceilInt(subtotal * internationalMultiplierApplied);
    }

    const markFee = computeMarkFee(specialMarks);
    const calculatedPrice = subtotal + markFee;

    const minPrice = getMinPrice(boxType, body.deliveryType);
    const maxPrice = getMaxPrice(boxType, body.deliveryType);
    const totalCost = Math.min(Math.max(calculatedPrice, minPrice), maxPrice);

    const days = getDeliveryDays(body.deliveryType);
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);

    return c.json({
      success: true,
      estimate: {
        fromNodeId,
        toNodeId,
        route_cost: routeCost,
        route_path: route.path,
        route_cost_norm: routeCostNorm,
        box_type: boxType,
        service_multiplier: serviceMultiplier,
        base,
        shipping,
        weight_surcharge: weightSurcharge,
        international_multiplier_applied: internationalMultiplierApplied,
        mark_fee: markFee,
        calculated_price: calculatedPrice,
        min_price: minPrice,
        max_price: maxPrice,
        total_cost: totalCost,
        estimated_delivery_date: deliveryDate.toISOString().split("T")[0],
      },
    });
  }
}
