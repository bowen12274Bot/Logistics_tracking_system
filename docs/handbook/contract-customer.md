# 客戶（合約 / contract_customer）操作手冊

本文件描述「合約客戶」在客戶端 UI 的日常操作流程；規則與限制以 `docs/modules/contracts.md`、`docs/modules/payments.md`、`docs/modules/shipping.md`、`docs/modules/tracking.md` 為準。

## 角色定位

- `users.user_type = customer`
- `users.user_class = contract_customer`
- 特色：可使用「月結」與帳單/付款功能（視 `billing_preference` 與付款方式而定）

## 常用流程（客戶端）

### 1) 登入與帳務偏好設定

1. 登入後進入個人資料
2. 設定 `billing_preference`（例如：月結、信用卡、轉帳等；以後端驗證為準）

> 非合約客戶設定 `billing_preference = monthly` 會被拒絕；合約客戶才可使用。

### 2) 寄件（建立包裹）

與非合約客戶相同，但在付款方式上可選月結（實際值以 API 定義為準）。

建議順序：

1. 運費試算
2. 建立寄件單（付款方式選月結或其他允許方式）
3. 取得 `tracking_number` 後追蹤

### 3) 追蹤貨件

1. 以 `tracking_number` 查詢貨件
2. 若出現異常（exception），等待客服處理；必要時可提供補充資訊給客服

### 4) 查詢帳單與付款

典型 UI 流程：

1. 帳單列表：依月份/狀態（pending/paid/overdue）篩選
2. 帳單明細：查看該月貨件與金額構成
3. 付款：依系統提供方式完成付款（信用卡/轉帳等）
4. 付款紀錄：查詢歷次付款與關聯帳單

## Links

- 合約流程（權威）：`docs/modules/contracts.md`
- 金流與帳單（權威）：`docs/modules/payments.md`
- 寄件/包裹（權威）：`docs/modules/shipping.md`
- 追蹤顯示（權威）：`docs/modules/tracking.md`
- API（接口參考）：`docs/reference/api/03-packages.md`、`docs/reference/api/05-payments.md`、`docs/reference/api/01-users.md`

