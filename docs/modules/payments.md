# Payments & Billing（支付與帳務）

本文件整理支付/帳務的規則層：定義「誰付錢（預付/到付）」與「怎麼付（五種付款方式）」、以及付款/確認付款會如何影響「司機是否發車取件」與「月結帳期如何累計」。API 介面請看 `docs/reference/api/05-payments.md`（支付/帳單）與 `docs/reference/api/03-packages.md`（包裹欄位）。

## Intent（概念）

- 本專案的支付皆為模擬：除現金有「到場/到站」條件外，其餘方式按下即成功。
- 付款方式是 5 選 1（`cash` / `credit_card` / `bank_transfer` / `third_party_payment` / `monthly_billing`）。
- 月結帳單不是自動「配送完就加入」：它是付款方式之一，由寄件者在付款時主動選擇 `monthly_billing`，才會被納入帳期。
- 合約客戶仍可選擇現金/信用卡/網銀/第三方等方式直接付清，不一定要用月結。

## Data（資料落點）

- `packages.payment_type`：付款責任（`prepaid` / `cod`）
- `packages.payment_method`：付款方式（`cash` / `credit_card` / `bank_transfer` / `third_party_payment` / `monthly_billing`）
- `payments`：單件費用的計費/收款紀錄（`paid_at`、`collected_by`、`payer_user_id`、`package_id`）
- `monthly_billing` / `monthly_billing_items`：月結帳單（帳單主檔 + 帳單包含哪些包裹）
- `nodes.subtype`：判斷住家/超商（`home` / `store`）
- `package_events.delivery_status`：用來判斷「是否已到場/到站/卸貨」以決定現金/到付可否付款

## Core Rules（核心規則）

### 1) 付款責任（誰付）

- `prepaid`：寄件者付（寄件者登入後，在待付款清單中選擇付款方式）
- `cod`：收件者付（收件者需為系統內客戶才可到付，否則會退回成預付）

### 2) 付款方式（怎麼付）

- 五種付款方式：`cash` / `credit_card` / `bank_transfer` / `third_party_payment` / `monthly_billing`
- `monthly_billing` 僅限合約客戶選擇，且代表「入帳期、非立即付清」：
  - 包裹本身不會出現「已付款」紀錄
  - 會在帳期結算時列入當期帳單（`monthly_billing_items`）
  - 帳單到期後，必須以另外四種方式之一付清（不可再用 `monthly_billing` 付帳單）

### 3) 司機發車取件的付款門檻（Dispatch Gate）

- 寄件者建立包裹後，需要到「待付款清單」完成付款/確認付款，是否完成會影響司機是否可發車取件。
- 門檻規則（MVP）：
  - `prepaid` + `credit_card` / `bank_transfer` / `third_party_payment`：需先付清（產生 `payments.paid_at`）才可發車取件
  - `prepaid` + `monthly_billing`：需先完成「選擇月結」的確認，才可發車取件（入帳期，不立即付清）
  - `prepaid` + `cash`：需先完成「選擇現金」的確認，司機到場時再收款
  - `cod`：不影響取件發車（收件者在送達端付款）

### 4) 可付款時機（Payable Window）

- 預付（寄件者付）：
  - `credit_card` / `bank_transfer` / `third_party_payment`：建單後即可付
  - `cash`：
    - 住家：司機到達取件點後可付（以 `arrived_pickup` 事件作為門檻）
    - 超商：建單後即可付（視為交件時付款）
  - `monthly_billing`：建單後即可「選擇月結」（入帳期，不立即付清）
- 到付（收件者付）：
  - 住家：司機到達送件點後可付（以 `arrived_delivery` 事件作為門檻；現金/非現金皆同）
  - 超商：司機在 `END_STORE_*` 卸貨後可付（以 `delivered` 到 `END_STORE_*` 作為門檻）

### 5) 規則矩陣（摘要）

| 責任 | 付款方式 | 住家 | 超商 |
|---|---|---|---|
| 預付 | `credit_card` / `bank_transfer` / `third_party_payment` | 建單後可付清 | 建單後可付清 |
| 預付 | `cash` | `arrived_pickup` 後可付清 | 建單後可付清 |
| 預付 | `monthly_billing` | 建單後可選擇月結（入帳期） | 建單後可選擇月結（入帳期） |
| 到付 | `credit_card` / `bank_transfer` / `third_party_payment` | `arrived_delivery` 後可付清 | `delivered` 到 `END_STORE_*` 後可付清 |
| 到付 | `cash` | `arrived_delivery` 後可付清 | `delivered` 到 `END_STORE_*` 後可付清 |

### 6) 到付收件者（必備欄位）

- `payments.payer_user_id` 必須填入「實際付款人」：
  - 預付：寄件者 user id
  - 到付：收件者 user id（收件者需為已註冊客戶）

## Links

- API：`docs/reference/api/05-payments.md`
- Packages API：`docs/reference/api/03-packages.md`
- DB Schema：`docs/reference/database-schema.md`
