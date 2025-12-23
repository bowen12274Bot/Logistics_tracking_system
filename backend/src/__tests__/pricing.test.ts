import { describe, it, expect } from "vitest";
import {
  calculatePackagePrice,
  determineBoxType,
  computeVolumetricWeightKg,
  guessDimensionsFromBoxType,
  mapDeliveryTimeToType
} from "../utils/pricing";

describe("Pricing Logic Utils", () => {
  describe("determineBoxType", () => {
    it("should identify envelope", () => {
      expect(determineBoxType(25, 15, 1, 0.4)).toBe("envelope");
    });
    it("should identify S box", () => {
      // 35x25x15 <= 40x30x20
      expect(determineBoxType(35, 25, 15, 3)).toBe("S");
    });
    it("should identify M box", () => {
      // 50x30x30 <= 60x40x40
      expect(determineBoxType(50, 30, 30, 10)).toBe("M");
    });
    it("should identify L box", () => {
      // 80x50x50 <= 90x60x60
      expect(determineBoxType(80, 50, 50, 20)).toBe("L");
    });
    it("should return null for oversized", () => {
      expect(determineBoxType(100, 100, 100, 50)).toBe(null);
    });
    it("should account for weight limit", () => {
      // Dimensions OK for S, but weight 10kg > 5kg -> should be M (max 20kg)
      // S: max 5kg. M: max 20kg.
      expect(determineBoxType(35, 25, 15, 10)).toBe("M");
    });
  });

  describe("computeVolumetricWeightKg", () => {
    it("should calculate correctly", () => {
      // 60 * 40 * 40 = 96000 / 6000 = 16
      expect(computeVolumetricWeightKg(60, 40, 40)).toBe(16);
    });
  });

  describe("calculatePackagePrice", () => {
    it("should calculate price correctly for standard scenario", () => {
      // routeCost 5200 -> norm 1.0
      // Box M (base 110 + 1.0 * 260) = 370
      // Service Standard (1.25) -> ceil(370 * 1.25) = 463
      // Weight 12kg (volumetric 16kg?). Let's give specific dims.
      // Dims: 60x40x40 -> Volumetric 16kg. Real 12kg. Billable 16kg.
      // M included 10kg. Extra 6kg.
      // Surcharge 6 * 15 = 90.
      // Total 463 + 90 = 553.
      // Marks: None.
      // Min/Max for M/Standard: 260 / 1850.
      // Final 553.
      
      const res = calculatePackagePrice(
        5200, 
        12, 
        { length: 60, width: 40, height: 40 },
        "standard"
      );
      
      expect(res).not.toHaveProperty("error");
      if ("error" in res) return;

      expect(res.base).toBeCloseTo(370);
      expect(res.shipping).toBe(463);
      expect(res.weightSurcharge).toBe(90); // (16-10)*15
      expect(res.calculatedPrice).toBe(553);
    });
  });

  describe("guessDimensionsFromBoxType", () => {
    it("should return default dimensions for M", () => {
      expect(guessDimensionsFromBoxType("M")).toEqual({ length: 60, width: 40, height: 40 });
    });
    it("should return envelope dims", () => {
      expect(guessDimensionsFromBoxType("envelope")).toEqual({ length: 30, width: 20, height: 2 });
    });
  });
});
