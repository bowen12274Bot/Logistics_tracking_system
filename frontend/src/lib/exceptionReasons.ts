export type ExceptionReportRole = "driver" | "warehouse_staff" | "customer_service";

export type ExceptionReasonCode =
  | "lost"
  | "damaged"
  | "unpaid"
  | "sender_not_ready"
  | "no_answer"
  | "refused"
  | "address_issue"
  | "label_issue"
  | "misroute"
  | "other";

export type ExceptionReason = {
  code: ExceptionReasonCode;
  i18nKey: string;
  selectableBy: Partial<Record<ExceptionReportRole, boolean>>;
  customerVisible: boolean;
};

export const EXCEPTION_REASONS: ExceptionReason[] = [
  { code: "lost", i18nKey: "exception.reason.lost", selectableBy: { driver: true, warehouse_staff: true }, customerVisible: true },
  { code: "damaged", i18nKey: "exception.reason.damaged", selectableBy: { driver: true, warehouse_staff: true }, customerVisible: true },
  { code: "unpaid", i18nKey: "exception.reason.unpaid", selectableBy: { driver: true }, customerVisible: true },
  { code: "sender_not_ready", i18nKey: "exception.reason.sender_not_ready", selectableBy: { driver: true }, customerVisible: true },
  { code: "no_answer", i18nKey: "exception.reason.no_answer", selectableBy: { driver: true }, customerVisible: true },
  { code: "refused", i18nKey: "exception.reason.refused", selectableBy: { driver: true }, customerVisible: true },
  { code: "address_issue", i18nKey: "exception.reason.address_issue", selectableBy: { driver: true }, customerVisible: true },
  { code: "label_issue", i18nKey: "exception.reason.label_issue", selectableBy: { warehouse_staff: true }, customerVisible: true },
  { code: "misroute", i18nKey: "exception.reason.misroute", selectableBy: { warehouse_staff: true }, customerVisible: true },
  { code: "other", i18nKey: "exception.reason.other", selectableBy: { driver: true, warehouse_staff: true }, customerVisible: true },
];

export const exceptionReasonLabel = (
  code: string | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
) => {
  const key = String(code ?? "").trim();
  const hit = EXCEPTION_REASONS.find((r) => r.code === key);
  if (hit) return t(hit.i18nKey);
  if (key) return t("exception.reason.unknownWithCode", { code: key });
  return t("exception.reason.unknown");
};

export const selectableReasonsFor = (role: ExceptionReportRole) =>
  EXCEPTION_REASONS.filter((r) => Boolean(r.selectableBy[role]));
