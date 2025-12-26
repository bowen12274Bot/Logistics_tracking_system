# Features（以功能/用例撰寫）

本目錄用「功能（Use Case / Capability）」整理專案端到端流程：UI → 規則（modules）→ API（reference）。

快速定位：

- `docs/handbook/`：角色操作手冊（怎麼做）
- `docs/modules/`：規則權威（為什麼這樣做、門檻/限制）
- `docs/reference/api/`：接口參考（endpoint / schema）
- `docs/features/`：端到端功能（怎麼串起來）

## Customer

| 功能 | UI | 規則 | API |
|---|---|---|---|
| 估價 | `/customer/send` | `docs/modules/pricing.md` | `docs/reference/api/03-packages.md`（`POST /api/packages/estimate`） |
| 建立訂單（寄件） | `/customer/send` | `docs/modules/shipping.md` | `docs/reference/api/03-packages.md`（`POST /api/packages`） |
| 包裹付款（單件） | `/customer/payment` | `docs/modules/payments.md` | `docs/reference/api/05-payments.md`（`/api/payments/packages*`） |
| 合約申請 / 月結體驗 | `/customer/contract` | `docs/modules/contracts.md`、`docs/modules/payments.md` | `docs/reference/api/01-users.md`、`docs/reference/api/02-review.md`、`docs/reference/api/05-payments.md` |
| 追蹤查詢 | `/customer/track` | `docs/modules/tracking.md`、`docs/modules/exceptions.md` | `docs/reference/api/03-packages.md`（`GET /api/packages/:packageId/status`、`GET /api/tracking/:trackingNumber`） |
| 個人資料與偏好 | `/customer/profile` | `docs/modules/users.md`、`docs/modules/payments.md` | `docs/reference/api/01-users.md`（`PUT /api/customers/me`、`GET /api/auth/me`） |

- `docs/features/customer-estimate-shipping.md`
- `docs/features/customer-create-package.md`
- `docs/features/customer-pay-package.md`
- `docs/features/customer-monthly-billing.md`
- `docs/features/customer-track-package.md`
- `docs/features/customer-profile-and-preference.md`

## Customer Service（CS）

| 功能 | UI | 規則 | API |
|---|---|---|---|
| 合約申請審核 | CS/管理後台 | `docs/modules/contracts.md` | `docs/reference/api/02-review.md` |
| 異常池（檢視/結案） | CS/管理後台 | `docs/modules/exceptions.md` | `docs/reference/api/07-exceptions.md`（`GET /api/cs/exceptions`、`POST /api/cs/exceptions/:exceptionId/handle`） |
| 查帳支援（協助客戶查帳單） | CS/管理後台 | `docs/modules/payments.md` | `docs/reference/api/05-payments.md`（`GET /api/billing/bills*`） |

- `docs/features/review-contract-application.md`
- `docs/features/cs-exception-pool-and-handle.md`
- `docs/features/cs-billing-support.md`

## Warehouse

| 功能 | UI | 規則 | API |
|---|---|---|---|
| 點收/分揀 | 倉儲作業台 | `docs/modules/operations.md`、`docs/modules/shipping.md` | `docs/reference/api/01-users.md`（warehouse 區段） |
| 派發下一段任務 | 倉儲作業台 | `docs/modules/operations.md` | `docs/reference/api/01-users.md`（`POST /api/warehouse/packages/:packageId/dispatch-next`） |
| 倉儲異常申報 | 倉儲作業台 | `docs/modules/exceptions.md` | `docs/reference/api/07-exceptions.md`（`POST /api/warehouse/packages/:packageId/exception`） |

- `docs/features/warehouse-receive-and-sorting.md`
- `docs/features/warehouse-dispatch-next-task.md`

## Driver

| 功能 | UI | 規則 | API |
|---|---|---|---|
| 任務流程（V2 tasks） | 司機任務 | `docs/modules/operations.md` | `docs/reference/api/01-users.md`（driver 區段、`/api/driver/tasks/...`） |
| 現金收款（預付/到府代收） | 司機任務 | `docs/modules/payments.md` | `docs/reference/api/01-users.md`（`POST /api/driver/packages/:packageId/collect-cash`） |

- `docs/features/driver-task-lifecycle.md`
- `docs/features/driver-cash-collection.md`

## Admin

| 功能 | UI | 規則 | API |
|---|---|---|---|
| 員工帳號/RBAC | 管理後台 | `docs/modules/users.md`、`docs/modules/operations.md` | `docs/reference/api/06-super-user.md` |
| 帳務作業（結算/調整/補救） | 管理後台 | `docs/modules/payments.md` | `docs/reference/api/05-payments.md`（admin 區段） |

- `docs/features/admin-user-management.md`
- `docs/features/admin-billing-operations.md`

## Exceptions（端到端）

> 這份是跨角色（Driver/Warehouse/CS）的「異常閉環」規格；CS 的 UI/操作可另看 `docs/features/cs-exception-pool-and-handle.md`。

- `docs/features/exception-report-and-handle.md`
