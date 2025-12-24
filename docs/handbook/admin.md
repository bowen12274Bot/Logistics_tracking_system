# 管理員（admin）操作手冊

本文件描述「管理員」在管理端 UI 的日常操作流程；規則與一致性以 `docs/modules/users.md`、`docs/modules/contracts.md`、`docs/modules/payments.md` 為準。

## 角色定位

- `users.user_type = employee`
- `users.user_class = admin`
- 主要職責：人員管理、系統監控、帳單結算/調整、必要時協助合約審核

## 常用流程（管理端）

### 1) 建立員工帳號（RBAC）

1. 進入「人員管理 / 建立員工」
2. 填寫姓名、Email、電話、密碼
3. 選擇 `user_class`：`driver` / `warehouse_staff` / `customer_service` / `admin`
4.（若角色需要站點）設定 `address` 為地圖節點 ID（例如 `HUB_0` / `REG_3`）

### 2) 合約申請審核（必要時）

若客服量能不足或需管理員覆核：

1. 查找待審核申請
2. 進行 approve/reject 並填寫備註、額度（若有）
3. 審核結果會影響客戶 `user_class`（非合約 ↔ 合約）與可用付款/帳單能力

### 3) 月結帳單作業（Billing Admin）

1. 月底結算（cycle settle）：產出/結算指定月份帳單，設定繳費期限
2. 帳單調整（必要時）：調整帳單金額/狀態/期限
3. 明細調整（必要時）：新增/刪除帳單項目（僅在有明確稽核依據時）

### 4) 系統異常/錯誤查詢

1. 進入系統錯誤列表
2. 依等級、時間區間、是否已處理進行篩選
3. 針對高頻錯誤回溯：先看 request/context（若系統有記錄），再定位到對應模組與行為

## Links

- 使用者與權限（權威）：`docs/modules/users.md`
- 合約審核流程（權威）：`docs/modules/contracts.md`
- 金流與帳單（權威）：`docs/modules/payments.md`
- API（接口參考）：`docs/reference/api/06-super-user.md`、`docs/reference/api/05-payments.md`、`docs/reference/api/02-review.md`

