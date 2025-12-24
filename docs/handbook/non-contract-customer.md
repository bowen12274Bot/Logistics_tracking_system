# 客戶（非合約 / non_contract_customer）操作手冊

本文件描述「非合約客戶」在客戶端 UI 的日常操作流程；規則與限制以 `docs/modules/users.md`、`docs/modules/contracts.md`、`docs/modules/shipping.md`、`docs/modules/tracking.md` 為準。

## 角色定位

- `users.user_type = customer`
- `users.user_class = non_contract_customer`
- 特色：可寄件/追蹤；可申請合約；不可使用「月結」（合約核准後才可使用）

## 常用流程（客戶端）

### 1) 註冊 / 登入

1. 註冊：填寫姓名、Email、密碼、電話、地址（預設寄/收件地址）
2. 登入：使用 Email 或電話 + 密碼取得 token（客戶端通常由 UI 自行保存）

> 註冊時後端會強制 `user_class = non_contract_customer`，無法自行指定為合約客戶。

### 2) 寄件（建立包裹）

建議操作順序：

1. 運費試算：填寄件/收件地址與規格，先確認費用與預估送達
2. 建立寄件單：填寄件人/收件人、內容描述、尺寸/重量、配送時效、付款方式
3. 成功後取得 `tracking_number`，用於追蹤

注意事項：

- 非合約客戶不可用「月結」相關付款方式（若 UI 有此選項，應隱藏或顯示為不可用）
- 內容物描述通常屬必填（以實作與 API 驗證為準）

### 3) 追蹤貨件

1. 以 `tracking_number` 查詢貨件狀態與歷程（UI 會顯示 stage + timeline）
2. 若遇到異常（exception），通常會看到「目前狀態」標示異常，並等待客服處理結果

### 4) 申請成為合約客戶（Contract Application）

1. 進入合約申請頁
2. 填寫公司資訊、統編、聯絡人、帳單地址、備註
3. 送出後狀態為 `pending`，等待客服或管理員審核

審核通過後：

- `user_class` 會變更為 `contract_customer`
- 客戶即可設定/使用「月結」與帳單功能（以後端與 `docs/modules/contracts.md` 為準）

## Links

- 使用者與權限（權威）：`docs/modules/users.md`
- 合約審核流程（權威）：`docs/modules/contracts.md`
- 寄件/包裹（權威）：`docs/modules/shipping.md`
- 追蹤顯示（權威）：`docs/modules/tracking.md`
- API（接口參考）：`docs/reference/api/01-users.md`、`docs/reference/api/03-packages.md`

