import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestUser, createTestPackage } from "./helpers";

describe("Service Rules Integration (P1)", () => {
  let customerToken: string;

  beforeAll(async () => {
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("POST /api/packages/estimate", () => {
    it("should use default pricing rules (no DB rules)", async () => {
      // This endpoint now reads from service_rules table with fallback to DEFAULT_PRICING_RULES
      // Since test DB may not have service_rules seeded, it should use defaults
      
      const { status, data } = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          fromNodeId: "HUB_0",
          toNodeId: "END_HOME_0",
          weightKg: 5,
          dimensionsCm: { length: 30, width: 20, height: 15 },
          deliveryType: "standard",
          specialMarks: []
        })
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.estimate).toBeDefined();
      expect(data.estimate.box_type).toBe("S");
      expect(data.estimate.service_multiplier).toBe(1.25); // Standard multiplier from defaults
    });

    it("should apply international multiplier correctly", async () => {
      const { status, data } = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          fromNodeId: "HUB_0",
          toNodeId: "END_HOME_0",
          weightKg: 5,
          dimensionsCm: { length: 30, width: 20, height: 15 },
          deliveryType: "standard",
          specialMarks: ["international"]
        })
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.estimate.international_multiplier_applied).toBe(1.8);
    });

    it("should apply fragile and dangerous mark fees", async () => {
      const { status, data } = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          fromNodeId: "HUB_0",
          toNodeId: "END_HOME_0",
          weightKg: 5,
          dimensionsCm: { length: 30, width: 20, height: 15 },
          deliveryType: "standard",
          specialMarks: ["fragile", "dangerous"]
        })
      });

      expect(status).toBe(200);
      expect(data.estimate.mark_fee).toBe(180); // 60 + 120
    });
  });
});
