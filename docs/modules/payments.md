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
  - 客戶在待付清單「確認付款」後，包裹視為已付款（不再出現在待付清單）
  - 同時會加入當期「未出帳」區（`monthly_billing_items`）等待帳期結算
  - 帳單到期後，必須以另外四種方式之一付清（不可再用 `monthly_billing` 付帳單）

### 2.1 未出帳（本期累積）定義

- 月結帳單 `monthly_billing.due_date = NULL` 視為「未出帳」（本期累積區）。
- 出帳後才會填入 `due_date`（表示已結算並進入可繳費狀態）。

### 3) 司機發車取件的付款門檻（Dispatch Gate）

- 寄件者建立包裹後，需要到「待付款清單」完成付款/確認付款，是否完成會影響司機是否可發車取件。
- 門檻規則（MVP）：
  - `prepaid` + `credit_card` / `bank_transfer` / `third_party_payment`：需先付清（產生 `payments.paid_at`）才可發車取件
  - `prepaid` + `monthly_billing`：需先完成「確認月結付款」（入帳期，會產生 `payments.paid_at` 並加入本期未出帳區）才可發車取件
  - `prepaid` + `cash`：需先完成「確認付款（現金）」；司機到場時再收款
  - `cod`：不影響取件發車（收件者在送達端付款）

#### 司機視角補充（Driver View）

- 司機在任務面板會看到「運費是否已支付」以及「配送預約時間」，因此存在配送時間壓力。
- 由於客戶可隨時更改付款方式，司機當下看到的 `payment_method` 可能不是最終付款方式。
- 為了讓司機的現場操作一致：
  - 司機視角下，只要 `payments.paid_at` 尚未出現，就視為「未支付」，等同以「現金待收」處理（需要到場確認）。
  - 客戶允許在司機到場後再改付款方式並完成支付；只要付款完成（`payments.paid_at` 出現），司機即可放心取件/交付。
  - 若到場後仍未支付，司機需由現場確認（例如等待付款或取消/改期等，依營運規則處理）。

### 4) 可付款時機（Payable Window）

- 預付（寄件者付）：
  - `credit_card` / `bank_transfer` / `third_party_payment`：建單後即可付
  - `cash`：
    - 住家：司機到達取件點後可付（以 `arrived_pickup` 事件作為門檻）
    - 超商：建單後即可付（視為交件時付款）
  - `monthly_billing`：建單後即可「確認月結付款」（入帳期，視為已付款並納入本期未出帳區）
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
