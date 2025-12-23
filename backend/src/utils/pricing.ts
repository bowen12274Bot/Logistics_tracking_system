import { z } from "zod";

export type DeliveryType = "overnight" | "two_day" | "standard" | "economy";
export type SpecialMark = "fragile" | "dangerous" | "international";
export type BoxType = "envelope" | "S" | "M" | "L";

export const ROUTE_COST_K = 5200;
export const ROUTE_COST_NORM_MIN = 0.3;
export const ROUTE_COST_NORM_MAX = 1.6;
export const INTERNATIONAL_MULTIPLIER = 1.8;

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const ceilInt = (value: number) => Math.ceil(value);

export const getServiceMultiplier = (deliveryType: DeliveryType) => {
  const multipliers: Record<DeliveryType, number> = {
    economy: 1.0,
    standard: 1.25,
    two_day: 1.55,
    overnight: 2.0,
  };
  return multipliers[deliveryType];
};

export const getDeliveryDays = (deliveryType: DeliveryType) => {
  const days: Record<DeliveryType, number> = {
    overnight: 1,
    two_day: 2,
    standard: 3,
    economy: 5,
  };
  return days[deliveryType];
};

export const getBaseParams = (boxType: BoxType) => {
  const params: Record<BoxType, { baseFee: number; ratePerCost: number }> = {
    envelope: { baseFee: 30, ratePerCost: 90 },
    S: { baseFee: 70, ratePerCost: 170 },
    M: { baseFee: 110, ratePerCost: 260 },
    L: { baseFee: 160, ratePerCost: 380 },
  };
  return params[boxType];
};

export const getWeightSurchargeParams = (boxType: BoxType) => {
  const params: Record<BoxType, { includedWeightKg: number; perKgFee: number }> = {
    envelope: { includedWeightKg: 0.5, perKgFee: 0 },
    S: { includedWeightKg: 3, perKgFee: 18 },
    M: { includedWeightKg: 10, perKgFee: 15 },
    L: { includedWeightKg: 25, perKgFee: 12 },
  };
  return params[boxType];
};

export const getMinPrice = (boxType: BoxType, deliveryType: DeliveryType) => {
  const table: Record<BoxType, Record<DeliveryType, number>> = {
    envelope: { economy: 50, standard: 70, two_day: 90, overnight: 120 },
    S: { economy: 120, standard: 160, two_day: 210, overnight: 280 },
    M: { economy: 200, standard: 260, two_day: 340, overnight: 450 },
    L: { economy: 320, standard: 420, two_day: 550, overnight: 750 },
  };
  return table[boxType][deliveryType];
};

export const getMaxPrice = (boxType: BoxType, deliveryType: DeliveryType) => {
  const table: Record<BoxType, Record<DeliveryType, number>> = {
    envelope: { economy: 400, standard: 550, two_day: 700, overnight: 950 },
    S: { economy: 900, standard: 1200, two_day: 1500, overnight: 1900 },
    M: { economy: 1400, standard: 1850, two_day: 2350, overnight: 2900 },
    L: { economy: 2200, standard: 2900, two_day: 3700, overnight: 4600 },
  };
  return table[boxType][deliveryType];
};

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

export const computeMarkFee = (specialMarks: SpecialMark[]) => {
  let markFee = 0;
  if (specialMarks.includes("dangerous")) markFee += 120;
  if (specialMarks.includes("fragile")) markFee += 60;
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
  specialMarks: SpecialMark[] = []
): PricingResult | { error: string } => {
  const routeCostNormRaw = routeCost / ROUTE_COST_K;
  const routeCostNorm = clamp(routeCostNormRaw, ROUTE_COST_NORM_MIN, ROUTE_COST_NORM_MAX);

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

  const serviceMultiplier = getServiceMultiplier(deliveryType);
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

  const minPrice = getMinPrice(boxType, deliveryType);
  const maxPrice = getMaxPrice(boxType, deliveryType);
  const totalCost = Math.min(Math.max(calculatedPrice, minPrice), maxPrice);

  const days = getDeliveryDays(deliveryType);
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
