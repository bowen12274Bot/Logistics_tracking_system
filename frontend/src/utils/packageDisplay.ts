import type { PackageRecord } from "../services/api";

export const formatMoney = (value?: number | null) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat().format(Number.isFinite(amount) ? amount : 0);
};

export const formatDateTime = (value?: string | null, locale?: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "--";
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  const targetLocale = locale === 'en-US' ? 'en-US' : 'zh-TW';
  return date.toLocaleString(targetLocale);
};

export const getDescription = (pkg: PackageRecord): Record<string, any> => {
  const raw = (pkg as any).description_json;
  return raw && typeof raw === "object" ? (raw as any) : {};
};

export const isCodPackage = (pkg: PackageRecord) => String(pkg.payment_type ?? "").trim().toLowerCase() === "cod";

type Translate = (key: string, params?: Record<string, unknown>) => string;

export const senderDisplayName = (pkg: PackageRecord, authUserName?: string | null, t?: Translate) => {
  const description = getDescription(pkg);
  const missing = t ? t("common.missing") : "-";
  const fallback = isCodPackage(pkg) ? missing : authUserName || missing;
  return pkg.sender_name || (pkg as any).sender || description.sender_name || description.sender || fallback;
};

export const receiverDisplayName = (pkg: PackageRecord, authUserName?: string | null, t?: Translate) => {
  const description = getDescription(pkg);
  const missing = t ? t("common.missing") : "-";
  const fallback = isCodPackage(pkg) ? authUserName || missing : missing;
  return pkg.receiver_name || (pkg as any).receiver || description.receiver_name || description.receiver || fallback;
};

export const parseDimensionsFromSize = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)\s*[xX×*]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { length: Number(match[1]), width: Number(match[2]), height: Number(match[3]) };
};

export const dimensionsLabel = (pkg: PackageRecord) => {
  const parsed = parseDimensionsFromSize(pkg.size);
  if (parsed) return `${parsed.length}×${parsed.width}×${parsed.height} cm`;
  return pkg.size || "--";
};

export const resolveDeliveryLabel = (value?: string | null, t?: Translate) => {
  const key = String(value ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    overnight: "send.deliveryTime.overnight",
    two_day: "send.deliveryTime.twoDay",
    standard: "send.deliveryTime.standard",
    economy: "send.deliveryTime.economy",
  };
  const i18nKey = map[key];
  if (i18nKey && t) return t(i18nKey);
  return key || "-";
};

export const resolveSpecialMarks = (pkg: PackageRecord, t?: Translate) => {
  const description = getDescription(pkg);
  const handling =
    description.special_handling && typeof description.special_handling === "object" ? description.special_handling : {};

  const rawList = (() => {
    try {
      const parsed = (pkg as any).special_handling ? JSON.parse(String((pkg as any).special_handling)) : null;
      return Array.isArray(parsed) ? parsed.map((s) => String(s)) : [];
    } catch {
      return [];
    }
  })();

  const marks: string[] = [];
  const dangerous = Boolean(handling.dangerous_materials) || rawList.includes("dangerous_materials");
  const fragile = Boolean(handling.fragile_items) || rawList.includes("fragile_items");
  const international = Boolean(handling.international_shipments) || rawList.includes("international_shipments");

  if (dangerous) marks.push(t ? t("send.package.dangerous") : "Dangerous");
  if (fragile) marks.push(t ? t("send.package.fragile") : "Fragile");
  if (international) marks.push(t ? t("send.package.international") : "International");
  return marks;
};

export const resolveNotes = (pkg: PackageRecord) => {
  const description = getDescription(pkg);
  const notes = [String(pkg.contents_description ?? "").trim(), String(description.pickup_notes ?? "").trim(), String(description.notes ?? "").trim()].filter(
    Boolean,
  );
  return notes.join(" / ");
};

