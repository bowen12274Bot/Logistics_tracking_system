# 功能：建立寄件單（Package Create）

本文件描述客戶端「建立寄件單」的端到端流程：包含運費試算、到付（COD）可用性檢查、建立包裹、以及建立後前往付款。

## 適用角色與前置條件

- 角色：`customer`（合約/非合約皆可建立包裹）
- 前置：需登入取得 Token（客戶端 UI 會保管）
- 地址格式：以地圖節點 ID 為準，例如 `END_HOME_0` / `END_STORE_0`

## UI 對應頁面

- 建立寄件：`/customer/send`（`frontend/src/views/CustomerSendView.vue`）
- 建單後付款：`/customer/payment`

## 流程總覽（End-to-End）

1.（建議）運費試算：呼叫 `POST /api/packages/estimate`
2.（到付才需要）檢查收件人是否為系統內客戶：呼叫 `GET /api/customers/exists`
3. 建立寄件單：呼叫 `POST /api/packages`
4. 前往付款清單完成「確認付款」：呼叫 `GET /api/payments/packages` → `POST /api/payments/packages/:packageId/method`（選擇）→ `POST /api/payments/packages/:packageId`（確認）
5. 追蹤：`GET /api/tracking/:trackingNumber`（公開）或 `GET /api/packages/:packageId/status`（需登入）

## 規則與限制（摘要）

- 運費試算與計價規格：以 `routeCost` 計價，權威見 `docs/modules/pricing.md`
- 到付（COD）限制：
  - COD 付款人必須是「系統內已註冊客戶」才能成立
  - 若 COD 付款人無法解析，後端允許建立包裹但會把 `payment_type` 降級為 `prepaid`，並在 `metadata` 留下原因（屬於防呆與避免建單失敗）
- 建單後會同步建立一筆待付費用（可在付款清單查到），客戶仍需「再次確認付款」才算付款完成
- 月結：
  - 非合約客戶不可設定 `billing_preference = monthly`
  - 非合約客戶不可把包裹付款方式改成 `monthly_billing`（後端在更新付款方式與確認付款都會擋）

## UI 驗證規則（客戶端會先擋）

以下行為對齊目前客戶端 UI（`CustomerSendView`）：

- 必填：寄/收件者姓名、電話、地址
- 地址格式依寄件/取件方式不同：
  - 寄件方式 `home`：`sender_address` 必須是 `END_HOME_<n>`
  - 寄件方式 `store`：`sender_address` 必須是 `END_STORE_<n>`
  - 目的地 `home`：`receiver_address` 必須是 `END_HOME_<n>`
  - 目的地 `store`：`receiver_address` 必須是 `END_STORE_<n>`
- 包裹規格必填：`weight`、`length`、`width`、`height`（需為正整數）
- 到府取件必填：`pickup_date` + `pickup_time_window`
- 若選擇到付（`payment_type=cod`），會先做「收件人是否為系統內客戶」檢查；不符合就禁止送出

## API 串接（按功能拆解）

### 1) 運費試算（建議先做）

- `POST /api/packages/estimate`
- 使用者輸入：`fromNodeId`、`toNodeId`、重量、長寬高、配送時效、特殊標記
- 回傳：`route_cost`、`route_path`、`box_type`、`total_cost`、`estimated_delivery_date`

參考：
- 規格：`docs/modules/pricing.md`
- API：`docs/reference/api/03-packages.md`

### 2) 到付（COD）可用性檢查（只有付款責任選到付時）

- `GET /api/customers/exists?phone=...&name=...`
- 目的：判斷收件者是否為系統內客戶；若不是，客戶端 UI 需禁止選到付

參考：
- 實作：`backend/src/endpoints/customerExists.ts`

### 3) 建立寄件單（POST /api/packages）

客戶端 UI 目前送出的重點欄位（摘要）：

- 寄/收件資訊：`sender_name`、`sender_phone`、`sender_address`、`receiver_name`、`receiver_phone`、`receiver_address`
- 規格：`weight`、`length`、`width`、`height`、`declared_value`、`contents_description`
- 配送：`delivery_time`
- 付款責任：`payment_type`（`prepaid` / `cod`）
- 到府取件（只在寄件方式為到府時）：`pickup_date`、`pickup_time_window`、`pickup_notes`
- 路徑（可選）：`route_path`（JSON 字串），通常由試算的 `route_path` 帶入
- 其他：`metadata`（例如 `pickup_type`、`destination_type`）

參考：
- API：`docs/reference/api/03-packages.md`

#### Request 範例：到府取件 → 送到超商（預付）

```json
{
  "customer_id": "uuid",
  "sender_name": "王小明",
  "sender_phone": "0912-345-678",
  "sender_address": "END_HOME_0",
  "receiver_name": "李小華",
  "receiver_phone": "0988-000-111",
  "receiver_address": "END_STORE_3",
  "weight": 2,
  "length": 60,
  "width": 40,
  "height": 40,
  "delivery_time": "standard",
  "payment_type": "prepaid",
  "contents_description": "文件",
  "pickup_date": "2025-12-26",
  "pickup_time_window": "15:00-18:00",
  "pickup_notes": "請先電話聯絡",
  "route_path": "[\"END_HOME_0\",\"REG_0\",\"HUB_0\",\"REG_1\",\"END_STORE_3\"]",
  "metadata": {
    "pickup_type": "home",
    "destination_type": "store"
  }
}
```

#### Request 範例：超商寄件 → 送到住家（到付）

> 付款責任選到付時，客戶端會先呼叫 `/api/customers/exists` 檢查收件者是否為系統內客戶。

```json
{
  "customer_id": "uuid",
  "sender_name": "王小明",
  "sender_phone": "0912-345-678",
  "sender_address": "END_STORE_0",
  "receiver_name": "李小華",
  "receiver_phone": "0988-000-111",
  "receiver_address": "END_HOME_9",
  "weight": 1,
  "length": 30,
  "width": 20,
  "height": 10,
  "delivery_time": "two_day",
  "payment_type": "cod",
  "contents_description": "小包裹",
  "metadata": {
    "pickup_type": "store",
    "destination_type": "home"
  }
}
```

#### Response 範例（重點欄位）

```json
{
  "success": true,
  "package": {
    "id": "uuid",
    "tracking_number": "TRK-xxxx-xxxxxxxx",
    "customer_id": "uuid",
    "payment_type": "prepaid",
    "payment_method": "cash",
    "route_path": "[\"END_HOME_0\",\"REG_0\",\"HUB_0\",\"REG_1\",\"END_STORE_3\"]"
  }
}
```

> 注意：若你送出 `payment_type=cod` 但後端無法解析到付付款人（例如收件者資訊不完整或查無此人），後端可能會降級為 `prepaid`，並在回傳/描述欄位裡保留原因供 UI 顯示。

### 4) 建單後付款（付款清單 → 選擇付款方式 → 確認付款）

- `GET /api/payments/packages`：查待付/已付（含 `payable_now` / `reason`）
- `POST /api/payments/packages/:packageId/method`：更新付款方式（意圖/選擇，不等於付款）
- `POST /api/payments/packages/:packageId`：確認付款（寫入 `paid_at`）

`payable_now` 常見門檻（摘要）：
- 預付現金到府：需 `arrived_pickup`
- 到付（住家）：需 `arrived_delivery`
- 到付（超商）：需 `delivered`

參考：
- 規則：`docs/modules/payments.md`
- API：`docs/reference/api/05-payments.md`

## 資料落點（你在追問題時應該看哪裡）

- `packages`：包裹主檔（含 `customer_id`、`delivery_time`、`route_path`、`status` 等）
- `payments`：待付/已付（`payer_user_id`、`payment_method`、`paid_at`）
- `package_events`：追蹤事件（客戶追蹤圖、`payable_now` 判定都依賴事件）
- `monthly_billing` / `monthly_billing_items`：月結帳單（`due_date = NULL` 代表未出帳累積）

參考：
- `docs/reference/database-schema.md`
