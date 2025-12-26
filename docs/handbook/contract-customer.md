# 客戶（合約 / contract_customer）操作手冊

本文件描述「合約客戶」在客戶端 UI 的日常操作流程；規則與限制以 `docs/modules/contracts.md`、`docs/modules/payments.md`、`docs/modules/shipping.md`、`docs/modules/tracking.md` 為準。

## 角色定位

- `users.user_type = customer`
- `users.user_class = contract_customer`
- 特色：可設定 `billing_preference = monthly` 作為預設付款偏好，並可在「付款清單」選擇 `payment_method = monthly_billing` 進入月結流程（但仍需在付款頁「再次確認付款」才會生效）。

## 重要名詞（避免混淆）

- `billing_preference`：客戶的「預設偏好」（在建立訂單時可用來預設 `payment_method`）。
  - 值：`cash | credit_card | bank_transfer | monthly | third_party_payment`
  - 限制：非合約客戶不可設定 `monthly`（會被拒絕）。
- `payment_method`：包裹付款的「實際付款方式」。
  - 值：`cash | credit_card | bank_transfer | third_party_payment | monthly_billing`
  - 限制：`monthly_billing` 僅合約客戶可選，且只適用 `payment_type = prepaid`。
- `payment_type`：付款責任（誰付錢）：`prepaid`（寄件者付） / `cod`（收件者付）。
- `due_date = NULL`：月結帳單的「未出帳」狀態（本期累積區）。出帳後才會有 `due_date`。

## 地址格式（本專案以地圖節點 ID 為準）

客戶在寄件/試算/追蹤等流程使用的是「地圖節點 ID」，不是座標字串：

- 住家：`END_HOME_<n>`（例如 `END_HOME_0`）
- 超商：`END_STORE_<n>`（例如 `END_STORE_0`）

## 常用流程（客戶端）

### 1) 登入與帳務偏好設定

1. 登入後進入個人資料
2. 設定 `billing_preference`（例如：月結、信用卡、轉帳等；以後端驗證為準）

> 非合約客戶設定 `billing_preference = monthly` 會被拒絕；合約客戶才可使用。

### 2) 寄件（建立包裹）

與非合約客戶相同，但在付款方式上可走月結流程（細節見下方「付款清單」）。

建議順序：

1. 運費試算
2. 建立寄件單（建立後會產生待付款項目）
3. 前往 `/customer/payment` 完成「確認付款」
4. 取得 `tracking_number` 後追蹤

#### 運費試算（routeCost 計價）

- 以 `fromNodeId` / `toNodeId`（地圖節點 ID）試算運費，並回傳 `route_path` 作為路徑參考。
- 規格權威：`docs/modules/pricing.md`

### 3) 追蹤貨件

1. 以 `tracking_number` 查詢貨件
2. 若出現異常（exception），等待客服處理；必要時可提供補充資訊給客服

### 4) 查詢帳單與付款

目前客戶端的關鍵畫面分工如下：

1. 待付款清單：`/customer/payment` →「付款清單」
   - 會列出需要你付款的包裹費用（預付：寄件者；到付：收件者）
   - 可先「選擇/更新付款方式」（只是意圖，不代表已付款），再按「確認付款」才會寫入付款完成
   - 系統會回傳 `payable_now` / `reason`：代表目前是否可付款，以及不可付款的原因（例如現金到府需司機到場後才可付）
   - 合約客戶才可將付款方式更新為 `monthly_billing`；若被繞過（不應發生），後端在「更新付款方式」與「確認付款」都會再擋一次
2. 本期月結（未出帳區）：`/customer/contract`
   - 合約客戶在「付款清單」選擇 `monthly_billing` 並按「確認付款」後：
     - 該包裹視為已付款（不再出現在待付款清單）
     - 會被加入本期「未出帳」月結帳單，並在此頁可查看本期累積的包裹明細
   - 「未出帳」的判定：帳單 `due_date = NULL`
3. 付款紀錄：`/customer/payment` →「付款紀錄」
   - 現金/信用卡/網銀/第三方的包裹付款會出現在「包裹付款」區塊
   - 月結帳單在帳期結算出帳後，帳單付款完成才會出現在「月結帳單付款」區塊

#### 可付款時機（Payable Window）

付款清單中的 `payable_now` 會依付款責任、付款方式與事件門檻計算（摘要）：

- 預付（寄件者付）
  - 非現金：建單後即可付
  - 現金 + 住家：需 `arrived_pickup` 後可付
  - 現金 + 超商：建單後即可付
  - 月結（`monthly_billing`）：建單後可「確認月結付款」（入帳本期未出帳）
- 到付（收件者付）
  - 住家：需 `arrived_delivery` 後可付
  - 超商：需 `delivered` 到 `END_STORE_*` 後可付

## Links

- 合約流程（權威）：`docs/modules/contracts.md`
- 金流與帳單（權威）：`docs/modules/payments.md`
- 寄件/包裹（權威）：`docs/modules/shipping.md`
- 追蹤顯示（權威）：`docs/modules/tracking.md`
- 運費試算規格（權威）：`docs/modules/pricing.md`
- API（接口參考）：`docs/reference/api/03-packages.md`、`docs/reference/api/05-payments.md`、`docs/reference/api/01-users.md`

