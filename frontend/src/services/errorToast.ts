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

  if (rawMessage) return rawMessage;
  return t("errorToast.operationNotAllowed");
}

export function toastFromApiError(error: unknown, fallbackMessage: string) {
  const toast = useToasts();
  const t = i18n.global.t;

  if (isApiErrorLike(error)) {
    if (error.status === 401 || error.status === 403) return;

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
      toast.error(rawMessage);
      return;
    }
  }

  const rawMessage = messageFromUnknown(error) || String(fallbackMessage ?? "").trim();
  toast.error(rawMessage || t("errorToast.operationFailed"));
}

