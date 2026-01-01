import { useToasts } from "../components/ui/toast";
import { i18n } from "../i18n";

type ApiErrorLike = {
  name?: string;
  status: number;
  message: string;
  reason?: string;
  from?: string;
  to?: string;
};

function isApiErrorLike(error: unknown): error is ApiErrorLike {
  if (!error || typeof error !== "object") return false;
  const candidate = error as any;
  if (typeof candidate.status !== "number") return false;
  if (typeof candidate.message !== "string") return false;
  return candidate.name === "ApiError" || typeof candidate.reason === "string";
}

function messageFromUnknown(error: unknown): string {
  if (typeof error === "string") return error.trim();
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as any).message;
    if (typeof msg === "string") return msg.trim();
  }
  return "";
}

function resolve409Message(error: ApiErrorLike, rawMessage: string): string {
  const t = i18n.global.t;
  const reason = String(error.reason ?? "").trim().toLowerCase();
  const hint = [reason, String(error.from ?? ""), String(error.to ?? ""), rawMessage].join(" ").toLowerCase();

  if (reason.includes("not_at_node") || (hint.includes("not") && hint.includes("node"))) {
    return t("errorToast.notAtNode");
  }
  if (reason.includes("payment") && reason.includes("settled")) {
    return t("errorToast.paymentNotSettled");
  }
  if (reason.includes("exception")) {
    return t("errorToast.hasActiveException");
  }
  if (hint.includes("package not on truck") || hint.includes("pickup location")) {
    return t("errorToast.packageNotOnTruck");
  }

  // Translate the raw message using the common backend messages map
  if (rawMessage) return translateCommonBackendMessages(rawMessage);
  return t("errorToast.operationNotAllowed");
}

export function translateCommonBackendMessages(message: string): string {
  const t = i18n.global.t;
  const lowerMessage = message.toLowerCase().trim();

  // Map common backend error messages to i18n keys
  const messageMap: Record<string, string> = {
    // Authentication & Authorization
    "invalid credentials": "errorToast.invalidCredentials",
    "token missing": "errorToast.tokenMissing",
    "invalid token": "errorToast.invalidToken",
    "auth token storage failed": "errorToast.authTokenStorageFailed",
    "forbidden": "errorToast.forbidden",
    "not found": "errorToast.notFound",

    // User & Registration
    "email, password, and user_name are required": "errorToast.emailPasswordNameRequired",
    "identifier and password are required": "errorToast.identifierPasswordRequired",
    "email already exists": "errorToast.emailExists",

    // Package Related
    "package not found": "errorToast.packageNotFound",
    "package is terminal": "errorToast.packageTerminal",
    "package has active exception": "errorToast.hasActiveException",
    "payment not settled yet": "errorToast.paymentNotSettledYet",
    "cargo not found on this vehicle": "errorToast.cargoNotFound",
    "cargo already loaded": "errorToast.cargoAlreadyLoaded",
    "package not received yet": "errorToast.packageNotReceived",
    "package not in sorting area": "errorToast.packageNotInSorting",
    "package not at this warehouse node": "errorToast.packageNotAtWarehouse",
    "package has no latest event": "errorToast.packageNoLatestEvent",
    "package is on truck": "errorToast.packageOnTruck",
    "package already has an active task": "errorToast.packageHasActiveTask",
    "package has no sender_address": "errorToast.packageNoSenderAddress",

    // Task Related
    "task not found": "errorToast.taskNotFound",
    "task not eligible": "errorToast.taskNotEligible",
    "task already completed or canceled": "errorToast.taskAlreadyCompleted",
    "task has no from_location": "errorToast.taskNoFromLocation",
    "task not eligible for handoff": "errorToast.taskNotEligibleHandoff",
    "not eligible": "errorToast.notEligible",
    "invalid task type": "errorToast.invalidTaskType",

    // Location & Routing
    "not at task start node": "errorToast.notAtTaskStart",
    "not at pickup node": "errorToast.notAtPickupNode",
    "handoff not allowed from this node": "errorToast.handoffNotAllowed",
    "missing from/to": "errorToast.missingFromTo",
    "route not found": "errorToast.routeNotFound",
    "missing fromnodeid/tonodeid": "errorToast.missingNodeIds",
    "fromnodeid equals tonodeid": "errorToast.nodeIdsEqual",
    "invalid tonodeid": "errorToast.invalidNodeId",
    "not adjacent": "errorToast.notAdjacent",
    "cannot resolve resume start location": "errorToast.cannotResolveLocation",
    "cannot compute route to new destination": "errorToast.cannotComputeRoute",
    "already at destination": "errorToast.alreadyAtDestination",

    // Vehicle Related
    "vehicle has no current node": "errorToast.vehicleNoNode",
    "vehicle position changed": "errorToast.vehiclePositionChanged",
    "driver has no home node": "errorToast.driverNoHomeNode",
    "invalid home node id": "errorToast.invalidHomeNodeId",

    // Warehouse Related
    "warehouse has no node": "errorToast.warehouseNoNode",
    "missing tonodeid": "errorToast.missingToNodeId",
    "package not at this warehouse": "errorToast.packageNotAtWarehouse",

    // Payment Related
    "already paid": "errorToast.alreadyPaid",
    "not payable yet": "errorToast.notPayableYet",
    "invalid payment_method": "errorToast.invalidPaymentMethod",
    "monthly_billing is only available for prepaid/cod": "errorToast.monthlyBillingOnlyPrepaidCod",
    "monthly_billing requires contract_customer": "errorToast.monthlyBillingRequiresContract",

    // Customer Service & Exceptions
    "exception not found": "errorToast.exceptionNotFound",
    "already handled": "errorToast.alreadyHandled",
    "invalid cancel_reason": "errorToast.invalidCancelReason",
    "invalid handled": "errorToast.invalidHandledValue",
    "destination_override not found": "errorToast.destinationOverrideNotFound",
    "next_hop_override is required": "errorToast.nextHopOverrideRequired",
    "next_hop_override must be adjacent": "errorToast.nextHopMustBeAdjacent",

    // Tracking Related
    "location_id and vehicle_id cannot be used together": "errorToast.locationAndVehicleConflict",
    "customer not found": "errorToast.customerNotFound",
  };

  // Try exact match first
  if (messageMap[lowerMessage]) {
    return t(messageMap[lowerMessage]);
  }

  // Try partial match for messages with dynamic content
  for (const [key, value] of Object.entries(messageMap)) {
    if (lowerMessage.includes(key)) {
      return t(value);
    }
  }

  return message;
}

export function toastFromApiError(error: unknown, fallbackMessage: string) {
  const toast = useToasts();
  const t = i18n.global.t;

  if (isApiErrorLike(error)) {
    // Handle 401 with translated message
    if (error.status === 401) {
      const rawMessage = messageFromUnknown(error);
      const translatedMessage = rawMessage ? translateCommonBackendMessages(rawMessage) : t("errorToast.invalidCredentials");
      toast.warning(translatedMessage);
      return;
    }

    if (error.status === 403) return;

    const rawMessage = messageFromUnknown(error) || String(fallbackMessage ?? "").trim();

    if (error.status === 409) {
      toast.warning(resolve409Message(error, rawMessage));
      return;
    }

    if (error.status === 422) {
      toast.warning(rawMessage || t("errorToast.invalidInput"));
      return;
    }

    if (error.status >= 500) {
      toast.error(t("errorToast.systemBusy"));
      return;
    }

    if (rawMessage) {
      const translatedMessage = translateCommonBackendMessages(rawMessage);
      toast.error(translatedMessage);
      return;
    }
  }

  const rawMessage = messageFromUnknown(error) || String(fallbackMessage ?? "").trim();
  const translatedMessage = rawMessage ? translateCommonBackendMessages(rawMessage) : t("errorToast.operationFailed");
  toast.error(translatedMessage);
}

