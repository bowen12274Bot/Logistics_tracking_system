import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

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
              sender_address: z.string(),
              receiver_address: z.string(),
              weight: z.number().optional(),
              dimensions: z.object({
                length: z.number(),
                width: z.number(),
                height: z.number(),
              }).optional(),
              service_level: z.enum(["overnight", "two_day", "standard", "economy"]),
              special_handling: z.array(z.enum(["fragile", "dangerous", "international"])).optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "試算成功",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              estimate: z.object({
                base_cost: z.number(),
                distance_cost: z.number(),
                weight_surcharge: z.number(),
                special_handling_surcharge: z.number(),
                total_cost: z.number(),
                estimated_delivery_date: z.string(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json<{
      sender_address: string;
      receiver_address: string;
      weight?: number;
      dimensions?: { length: number; width: number; height: number };
      service_level: string;
      special_handling?: string[];
    }>();

    // 基本費用計算邏輯
    const baseCostByLevel: Record<string, number> = {
      overnight: 200,
      two_day: 150,
      standard: 100,
      economy: 60,
    };

    const baseCost = baseCostByLevel[body.service_level] || 100;

    // 距離費用（簡化：根據地址計算，這裡用模擬值）
    // 實際應該查詢 nodes + edges 表計算路線成本
    const distanceCost = 50; // 模擬固定值，實際需呼叫路線計算

    // 重量附加費
    const weight = body.weight || 1;
    const weightSurcharge = weight > 5 ? (weight - 5) * 10 : 0;

    // 特殊處理附加費
    let specialSurcharge = 0;
    if (body.special_handling) {
      if (body.special_handling.includes("fragile")) specialSurcharge += 30;
      if (body.special_handling.includes("dangerous")) specialSurcharge += 100;
      if (body.special_handling.includes("international")) specialSurcharge += 200;
    }

    const totalCost = baseCost + distanceCost + weightSurcharge + specialSurcharge;

    // 預計送達日期
    const deliveryDays: Record<string, number> = {
      overnight: 1,
      two_day: 2,
      standard: 3,
      economy: 5,
    };
    const days = deliveryDays[body.service_level] || 3;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);

    return c.json({
      success: true,
      estimate: {
        base_cost: baseCost,
        distance_cost: distanceCost,
        weight_surcharge: weightSurcharge,
        special_handling_surcharge: specialSurcharge,
        total_cost: totalCost,
        estimated_delivery_date: deliveryDate.toISOString().split("T")[0],
      },
    });
  }
}
