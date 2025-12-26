# Shipping / Packages（出貨單與包裹）

本文件描述出貨單建立與包裹主檔的規則層（含初始任務建立）；API 介面請見 `docs/reference/api/03-packages.md`（或從 `docs/reference/api-contract.md` 索引進入）。

## Intent（理念）

- `packages` 是「出貨單/包裹主檔」；所有狀態變化以 `package_events` 為事實來源。
- 建立包裹後會產生第一段任務（通常是 `END_* -> REG_*` 的取件段），讓司機端有明確工作項。

## Data（資料落點）

- `packages`：寄/收件節點、價格、路徑（`route_path`）、付款方式等
- `package_events`：建立/在途/站內/異常等事件
- `delivery_tasks`：任務段（建立包裹後至少會有初始 pickup 段）

## Core Rules（核心規則）

- 節點地址正規化：`sender_address` / `receiver_address` 以 `END_*` 節點為主（詳情以後端驗證為準）。
- 任務分段：每個 task 段跨越相鄰節點（由 `edges` 決定 adjacency）。

## Links

- API：`docs/reference/api/03-packages.md`
- 功能文檔：`docs/features/customer-create-package.md`、`docs/features/customer-estimate-shipping.md`
- 客戶手冊：`docs/handbook/non-contract-customer.md`、`docs/handbook/contract-customer.md`
- 作業執行：`docs/modules/operations.md`
- 追蹤顯示：`docs/modules/tracking.md`
- 運費/計價：`docs/modules/pricing.md`
