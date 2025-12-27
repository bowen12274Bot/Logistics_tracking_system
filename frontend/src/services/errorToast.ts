import { useToasts } from "../components/ui/toast";

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
  const reason = String(error.reason ?? "").trim().toLowerCase();
  const hint = [reason, String(error.from ?? ""), String(error.to ?? ""), rawMessage].join(" ").toLowerCase();

  if (reason.includes("not_at_node") || (hint.includes("not") && hint.includes("node"))) {
    return "你不在正確節點，請先移動到目的節點後再操作。";
  }
  if (reason.includes("payment") && reason.includes("settled")) {
    return "此包裹尚未完成付款/收現，請先完成收款後再繼續。";
  }
  if (reason.includes("exception")) {
    return "此包裹目前有未結案的異常，請先由客服處理後再繼續。";
  }

  if (rawMessage) return rawMessage;
  return "目前狀態不允許此操作，請稍後再試。";
}

export function toastFromApiError(error: unknown, fallbackMessage: string) {
  const toast = useToasts();

  if (isApiErrorLike(error)) {
    if (error.status === 401 || error.status === 403) return;

    const rawMessage = messageFromUnknown(error) || String(fallbackMessage ?? "").trim();

    if (error.status === 409) {
      toast.warning(resolve409Message(error, rawMessage));
      return;
    }

    if (error.status === 422) {
      toast.warning(rawMessage || "輸入資料有誤，請檢查後再試。");
      return;
    }

    if (error.status >= 500) {
      toast.error("系統忙碌，請稍後再試。");
      return;
    }

    if (rawMessage) {
      toast.error(rawMessage);
      return;
    }
  }

  const rawMessage = messageFromUnknown(error) || String(fallbackMessage ?? "").trim();
  toast.error(rawMessage || "操作失敗，請稍後再試。");
}
