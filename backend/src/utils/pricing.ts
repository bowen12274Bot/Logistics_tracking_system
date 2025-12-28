import { z } from "zod";

export type DeliveryType = "overnight" | "two_day" | "standard" | "economy";
export type SpecialMark = "fragile" | "dangerous" | "international";
export type BoxType = "envelope" | "S" | "M" | "L";

// Dynamic Rules Interface
export interface PricingRules {
  const: {
    route_cost_k: number;
    route_cost_norm_min: number;
    route_cost_norm_max: number;
    international_multiplier: number;
  };
  multipliers: {
    service: Record<DeliveryType, number>;
  };
  delivery_days: Record<DeliveryType, number>;
  box_params: Record<BoxType, { baseFee: number; ratePerCost: number }>;
  weight_surcharge: Record<BoxType, { includedWeightKg: number; perKgFee: number }>;
  min_price: Record<BoxType, Record<DeliveryType, number>>;
  max_price: Record<BoxType, Record<DeliveryType, number>>;
  mark_fees: Record<string, number>;
}

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const ceilInt = (value: number) => Math.ceil(value);

export const computeVolumetricWeightKg = (lengthCm: number, widthCm: number, heightCm: number) =>
  (lengthCm * widthCm * heightCm) / 6000;

export const determineBoxType = (
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

export const computeMarkFee = (specialMarks: SpecialMark[], rules: PricingRules) => {
  let markFee = 0;
  for (const mark of specialMarks) {
    if (rules.mark_fees[mark]) {
      markFee += rules.mark_fees[mark];
    }
  }
  return markFee;
};

export interface PricingResult {
  routeCost: number;
  routeCostNorm: number;
  boxType: BoxType;
  serviceMultiplier: number;
  base: number;
  shipping: number;
  weightSurcharge: number;
  internationalMultiplierApplied: number;
  markFee: number;
  calculatedPrice: number;
  minPrice: number;
  maxPrice: number;
  totalCost: number;
  estimatedDeliveryDate: string;
}

export const calculatePackagePrice = (
  routeCost: number,
  weightKg: number,
  dimensionsCm: { length: number; width: number; height: number },
  deliveryType: DeliveryType,
  specialMarks: SpecialMark[] = [],
  rules: PricingRules // Logic now depends on passed rules
): PricingResult | { error: string } => {
  const routeCostNormRaw = routeCost / rules.const.route_cost_k;
  const routeCostNorm = clamp(routeCostNormRaw, rules.const.route_cost_norm_min, rules.const.route_cost_norm_max);

  const volumetricWeightKg = computeVolumetricWeightKg(
    dimensionsCm.length,
    dimensionsCm.width,
    dimensionsCm.height,
  );
  const billableWeightKg = Math.max(weightKg, volumetricWeightKg);

  const boxType = determineBoxType(
    dimensionsCm.length,
    dimensionsCm.width,
    dimensionsCm.height,
    billableWeightKg,
  );
  if (!boxType) return { error: "Oversized package" };

  const serviceMultiplier = rules.multipliers.service[deliveryType] ?? 1.0;
  
  const boxParam = rules.box_params[boxType];
  const base = boxParam.baseFee + routeCostNorm * boxParam.ratePerCost;
  const shipping = ceilInt(base * serviceMultiplier);

  const weightParam = rules.weight_surcharge[boxType];
  const extraKg = Math.max(0, ceilInt(billableWeightKg - weightParam.includedWeightKg));
  const weightSurcharge = extraKg * weightParam.perKgFee;

  let subtotal = shipping + weightSurcharge;
  const internationalMultiplierApplied = specialMarks.includes("international")
    ? rules.const.international_multiplier
    : 1;
  if (internationalMultiplierApplied !== 1) {
    subtotal = ceilInt(subtotal * internationalMultiplierApplied);
  }

  const markFee = computeMarkFee(specialMarks, rules);
  const calculatedPrice = subtotal + markFee;

  const minPrice = rules.min_price[boxType][deliveryType];
  const maxPrice = rules.max_price[boxType][deliveryType];
  const totalCost = Math.min(Math.max(calculatedPrice, minPrice), maxPrice);

  const days = rules.delivery_days[deliveryType] ?? 3;
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + days);

  return {
    routeCost,
    routeCostNorm,
    boxType,
    serviceMultiplier,
    base,
    shipping,
    weightSurcharge,
    internationalMultiplierApplied,
    markFee,
    calculatedPrice,
    minPrice,
    maxPrice,
    totalCost,
    estimatedDeliveryDate: deliveryDate.toISOString().split("T")[0],
  };
};

export const mapDeliveryTimeToType = (deliveryTime?: string | null): DeliveryType => {
	const dt = String(deliveryTime ?? "").trim().toLowerCase();
	if (dt === "overnight") return "overnight";
	if (dt === "two_day") return "two_day";
	if (dt === "economy") return "economy";
	return "standard";
};

// Fallback helper to guess dimensions if only size string is provided (legacy support)
export const guessDimensionsFromBoxType = (sizeString: string): { length: number; width: number; height: number } => {
  const s = sizeString.trim().toLowerCase();
  // Return max dimensions for that box type to be safe, or average?
  // Use max dimensions to allow fitting.
  if (["envelope", "env", "xs"].includes(s)) return { length: 30, width: 20, height: 2 }; 
  if (["s", "small"].includes(s)) return { length: 40, width: 30, height: 20 };
  if (["l", "large"].includes(s)) return { length: 90, width: 60, height: 60 };
  // Default to M
  return { length: 60, width: 40, height: 40 };
};

// Fallback Rules (matches original constants) for reliability
export const DEFAULT_PRICING_RULES: PricingRules = {
  const: {
    route_cost_k: 5200,
    route_cost_norm_min: 0.3,
    route_cost_norm_max: 1.6,
    international_multiplier: 1.8,
  },
  multipliers: {
    service: { economy: 1.0, standard: 1.25, two_day: 1.55, overnight: 2.0 },
  },
  delivery_days: { overnight: 1, two_day: 2, standard: 3, economy: 5 },
  box_params: {
    envelope: { baseFee: 30, ratePerCost: 90 },
    S: { baseFee: 70, ratePerCost: 170 },
    M: { baseFee: 110, ratePerCost: 260 },
    L: { baseFee: 160, ratePerCost: 380 },
  },
  weight_surcharge: {
    envelope: { includedWeightKg: 0.5, perKgFee: 0 },
    S: { includedWeightKg: 3, perKgFee: 18 },
    M: { includedWeightKg: 10, perKgFee: 15 },
    L: { includedWeightKg: 25, perKgFee: 12 },
  },
  min_price: {
    envelope: { economy: 50, standard: 70, two_day: 90, overnight: 120 },
    S: { economy: 120, standard: 160, two_day: 210, overnight: 280 },
    M: { economy: 200, standard: 260, two_day: 340, overnight: 450 },
    L: { economy: 320, standard: 420, two_day: 550, overnight: 750 },
  },
  max_price: {
    envelope: { economy: 400, standard: 550, two_day: 700, overnight: 950 },
    S: { economy: 900, standard: 1200, two_day: 1500, overnight: 1900 },
    M: { economy: 1400, standard: 1850, two_day: 2350, overnight: 2900 },
    L: { economy: 2200, standard: 2900, two_day: 3700, "overnight": 4600 },
  },
  mark_fees: {
    dangerous: 120,
    fragile: 60
  }
};
