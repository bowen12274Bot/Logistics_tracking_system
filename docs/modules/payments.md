# Payments & Billing（支付與帳務）

本文件整理支付/帳務的規則層：定義「預付 / 到付 / 月結」誰付錢、以及各付款方式在不同場景（住家/超商）何時可付款。API 介面請看 `docs/reference/api/05-payments.md`（支付/帳單）與 `docs/reference/api/03-packages.md`（包裹欄位）。

## Intent（概念）

- 本專案的支付皆為模擬：除現金有「到場/到站」條件外，其餘方式按下即成功。
- 支付分兩條線：
  - 單件費用：預付 / 到付（跟包裹綁定）
  - 帳期費用：月結帳單（跟帳單綁定）

## Data（資料落點）

- `packages.payment_type`：付款責任（`prepaid` / `cod` / `monthly_billing`）
- `packages.payment_method`：付款方式（`cash` / `credit_card` / `online_bank` / `third_party` / `monthly_billing`）
- `payments`：單件費用的計費/收款紀錄（`paid_at`、`collected_by`、`payer_user_id`、`package_id`）
- `monthly_billing` / `monthly_billing_items`：月結帳單（帳單主檔 + 帳單包含哪些包裹）
- `nodes.subtype`：判斷住家/超商（`home` / `store`）
- `package_events.delivery_status`：用來判斷「是否已到場/到站/送達」以決定現金可否付款

## Core Rules（核心規則）

### 1) 付款責任（誰付）

- `prepaid`：寄件者付
- `cod`：收件者付
- `monthly_billing`：合約客戶以帳單付款（包裹不逐件付）

### 2) 場景判斷（住家 vs 超商）

- 以 `packages.sender_address` / `packages.receiver_address` 查 `nodes`，用 `nodes.subtype` 判斷：
  - `home`：住家
  - `store`：超商

### 3) 可付款時機（Payable Window）

- 預付（寄件者付）：
  - 信用卡/網銀/第三方：建單後即可付
  - 現金：
    - 住家：司機到達取件點（MVP：以 `picked_up` 事件作為門檻）
    - 超商：建單後即可付（視為交件時付款）
- 到付（收件者付）：
  - 住家：送達住家後可付（MVP：以 `delivered` 事件作為門檻；現金/非現金皆同）
  - 超商：抵達超商後可付（MVP：可用 `delivered` 到 `END_STORE_*`；若改用站點事件，需明確定義）
- 月結（帳單付）：
  - 月結包裹完成配送後加入當期帳單明細
  - 帳期出帳（帳單有 `due_date`）後才進待付清單
  - 帳單付款後才算支付紀錄（帳單層級）

### 4) 規則矩陣（摘要）

| 類型 | 付款方式 | 住家 | 超商 |
|---|---|---|---|
| 預付 | `credit_card` / `online_bank` / `third_party` | 建單後可付 | 建單後可付 |
| 預付 | `cash` | `picked_up` 後可付 | 建單後可付 |
| 到付 | `credit_card` / `online_bank` / `third_party` | `delivered` 後可付 | 抵達超商後可付 |
| 到付 | `cash` | `delivered` 後可付 | 抵達超商後可付 |
| 月結 | `monthly_billing` | 帳單出帳後在待付清單付款 | 帳單出帳後在待付清單付款 |

### 5) 到付收件者（必備欄位）

- `payments.payer_user_id` 必須填入「實際付款人」：
  - 預付：寄件者 user id
  - 到付：收件者 user id（收件者需為已註冊客戶）
  - 月結：帳單付款人（帳單層級）

## Links

- API：`docs/reference/api/05-payments.md`
- Packages API：`docs/reference/api/03-packages.md`
- DB Schema：`docs/reference/database-schema.md`
