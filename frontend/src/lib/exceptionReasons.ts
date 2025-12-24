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
  label: string;
  selectableBy: Partial<Record<ExceptionReportRole, boolean>>;
  customerVisible: boolean;
};

// Keep this list small and aligned with the simulated business flow.
// - Driver focuses on pickup/delivery situations.
// - Warehouse focuses on station sorting/label/misroute issues.
export const EXCEPTION_REASONS: ExceptionReason[] = [
  {
    code: "lost",
    label: "遺失 / 找不到包裹",
    selectableBy: { driver: true, warehouse_staff: true },
    customerVisible: true,
  },
  {
    code: "damaged",
    label: "損毀 / 外箱破損",
    selectableBy: { driver: true, warehouse_staff: true },
    customerVisible: true,
  },
  {
    code: "unpaid",
    label: "未付款 / 付款爭議",
    selectableBy: { driver: true },
    customerVisible: true,
  },
  {
    code: "sender_not_ready",
    label: "寄件者未備妥包裹",
    selectableBy: { driver: true },
    customerVisible: true,
  },
  {
    code: "no_answer",
    label: "客戶未應門 / 無法聯絡",
    selectableBy: { driver: true },
    customerVisible: true,
  },
  {
    code: "refused",
    label: "收件者拒收包裹",
    selectableBy: { driver: true },
    customerVisible: true,
  },
  {
    code: "address_issue",
    label: "地址問題 / 無法送達",
    selectableBy: { driver: true },
    customerVisible: true,
  },
  {
    code: "label_issue",
    label: "標籤 / 面單問題",
    selectableBy: { warehouse_staff: true },
    customerVisible: true,
  },
  {
    code: "misroute",
    label: "錯分 / 送錯站",
    selectableBy: { warehouse_staff: true },
    customerVisible: true,
  },
  {
    code: "other",
    label: "其他（請詳述）",
    selectableBy: { driver: true, warehouse_staff: true },
    customerVisible: true,
  },
];

export const exceptionReasonLabel = (code?: string | null) => {
  const key = String(code ?? "").trim();
  const hit = EXCEPTION_REASONS.find((r) => r.code === key);
  return hit?.label ?? (key ? `其他（${key}）` : "其他");
};

export const selectableReasonsFor = (role: ExceptionReportRole) =>
  EXCEPTION_REASONS.filter((r) => Boolean(r.selectableBy[role]));

