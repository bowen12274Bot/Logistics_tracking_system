# 客服員（customer_service）作業手冊

本文件描述客服端的 UI/操作步驟（怎麼做）；異常與合約的規則權威來源在 `docs/modules/`。

## 角色與職責

- 角色：`users.user_class = 'customer_service'`
- 核心職責：
  - 回應並審核合約申請（是否核准成為合約客戶）
  - 處理異常配送事件（做出決策並推動後續，使包裹回到可控狀態：恢復配送或終止配送）

## 工作清單（Task Board）

- 合約審核任務：檢視申請 → 核准/拒絕 → 填寫備註 → 送出結果
  - 核准後系統會立即把客戶升級為 `contract_customer`，並建立本期「未出帳」月結帳單（供客戶累積本期月結包裹）
- 異常處理任務：檢視異常 → 蒐集資訊 → 決策 → 執行（resume/cancel/指示）→ 結案

## 異常池（Exception Pool）

- 異常池：`package_exceptions.handled = 0` 的集合
- 指派（MVP）：單一客服情境可採「直接指派唯一客服」的簡化策略（不要求搶單/重新分派 UI）

## 異常處理流程（客服）

1. 檢視異常資訊（原因、描述、位置、時間、相關人員）
2. 蒐集資訊並與客戶/員工溝通（若需要）
3. 做出決策：
   - `resume`：恢復配送
   - `cancel`：終止配送（配送失敗）
   - disposition：先以 `handling_report` 指示後續處置
4. 結案：填寫 `handling_report`（必填）並提交

### 檢視異常資訊（建議欄位）

- 包裹識別：`tracking_number` / `package_id`
- 異常分類：`reason_code`（需中文顯示）
- 詳細說明：`description`
- 異常位置：節點（`END_*/REG_*/HUB_*`）或車上（`TRUCK_*`）
- 異常時間：`reported_at`
- 相關人員（可選）：申報者角色/身分（driver/warehouse_staff）與聯絡資訊（若存在）

### 執行決策（結案資料）

- `handling_report` 必填（作為稽核摘要）
- action：`resume` / `cancel`
- `exception_resolved.location` 建議由後端依「當下包裹留置位置」自動帶入（不由前端輸入）

## 顧客端顯示（客服需遵守的約束）

> 此段是客服在做決策/結案時，對顧客追蹤體驗的約束摘要；Stage 與追蹤推導規則請以 `docs/modules/tracking.md` 為準。

- 顯示分成三部分：
  - History：不可修改，只追加（append-only）
  - Current：需即時更新（例如正常/異常）
  - Forecast：若狀態或路徑改變需重算，且保持單一路徑（不分支/不雙線）
- 顏色語意（摘要）：正常=綠、異常=黃、配送失敗=紅
- 不可回寫歷史：異常申報後只影響「現在/未來」，不回溯改寫過去已發生的正常狀態
- 進入配送紀錄（History tab）條件：
  - 終端狀態：`delivered` 或 `delivery_failed`
  - 若收件者未確認：系統可在 7 天內自動歸類為完成（delivered 流程完成判定）

## Links

- 異常規則權威：`docs/modules/exceptions.md`
- 顧客追蹤與 Stage（權威）：`docs/modules/tracking.md`
- 使用者/權限規則權威：`docs/modules/users.md`
- 合約審核規則權威：`docs/modules/contracts.md`
- 金流與帳單（權威）：`docs/modules/payments.md`
- 功能文檔：`docs/features/cs-exception-pool-and-handle.md`、`docs/features/cs-billing-support.md`、`docs/features/review-contract-application.md`
- API（接口參考）：`docs/reference/api/07-exceptions.md`、`docs/reference/api/05-payments.md`、`docs/reference/api/02-review.md`
- 舊入口（保留連結）：`docs/customer-service.md`
