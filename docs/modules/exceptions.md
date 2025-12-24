# Exceptions（異常模組）

本文件是異常模組的「規則層」：定義異常申報/異常池/結案如何影響 `package_events`、`delivery_tasks`、顧客端顯示。

## Intent（理念）

- 異常成立後包裹應停止流轉（hold），避免司機/倉儲繼續寫入正常貨態造成衝突。
- 異常位置要能被顧客追蹤圖一致呈現：節點（點）或車上/在途（線）。

## Data（表與欄位）

- 異常池：`package_exceptions`
- 事件：`package_events`（`delivery_status='exception'|'exception_resolved'|'delivery_failed'`）
- 任務：`delivery_tasks`（異常成立會取消 active tasks）

## Reason Codes（`reason_code` 字典）

`reason_code` 是可擴充的「字串枚舉」（後端以字串儲存，不在 DB 做 enum）。前端/顧客端顯示用「中文分類」對照表；遇到未知 code 時，顧客端顯示「其他」並保留原始資料供內部查看。

> 顧客端呈現規範：只顯示「中文分類」（reason_code → 中文），不顯示 `description` / `handling_report`。

目前實作上：司機端點接受 `reason_code` 可選（但建議必填）；倉儲端點 `reason_code` 必填。

### 完整 `reason_code`（MVP：包裹問題，可擴充）

| reason_code | 中文顯示（顧客可見） | 司機可申報 | 倉儲可申報 | 說明（何時用） |
|---|---|:---:|:---:|---|
| `lost` | 遺失 / 找不到包裹 | ✅ | ✅ | 車上/站內找不到、交接點缺件 |
| `damaged` | 損毀 / 外箱破損 | ✅ | ✅ | 外箱破損/凹陷/明顯受損 |
| `unpaid` | 未付款 / 付款爭議 | ✅ |  | 貨到付款拒付、金額爭議（先停件） |
| `sender_not_ready` | 寄件者未備妥包裹 | ✅ |  | 取件時寄件者尚未備妥（先停件） |
| `no_answer` | 客戶未應門 / 無法聯絡 | ✅ |  | 到達取件/送件點，無人應門或無法聯絡（先停件） |
| `refused` | 收件者拒收包裹 | ✅ |  | 明確拒收或拒絕簽收（先停件） |
| `address_issue` | 地址問題 / 無法送達 | ✅ |  | 地址不存在、地址資訊不全、需客服協助更正（先停件） |
| `label_issue` | 標籤 / 面單問題 |  | ✅ | 條碼/面單破損、無法辨識、資訊不全（先停件） |
| `misroute` | 錯分 / 送錯站 |  | ✅ | 站內錯分、送錯站、路徑明顯不合理（先停件） |
| `other` | 其他（請詳述） | ✅ | ✅ | 不在以上分類（`description` 必填） |

### 角色可用清單（便於前端下拉選單）

- 司機（driver）：`lost`、`damaged`、`unpaid`、`sender_not_ready`、`no_answer`、`refused`、`address_issue`、`other`
- 倉儲（warehouse_staff）：`lost`、`damaged`、`label_issue`、`misroute`、`other`

## Location（權威與驗證）

### 1) `package_events.location` 的語意

- 節點 ID：`END_*` / `REG_*` / `HUB_*`（表示「在點上」）
- 車輛 ID：`TRUCK_*`（表示「在車上/在途」，用於前端線段呈現）

### 2) 權威來源（Priority）

異常相關的「位置」會同時牽涉多個資料來源，這裡先定義權威優先序，避免不同端點各自解讀：

1. **是否仍在車上**：以 `vehicle_cargo.unloaded_at IS NULL` 為準（若在車上，代表包裹留置於車上）
2. **車輛位置**：以 `vehicles.current_node_id` 為準（節點位置）
3. **事件位置**：以最新 `package_events(delivery_status='exception')` 的 `location` 作為「顧客追蹤圖顯示」的權威位置

> 簡化理解：`vehicle_cargo` 決定「在車上/不在車上」；`vehicles` 決定「車在哪個節點」；`package_events.location` 決定「顧客看到的點/線位置」。

### 3) Driver 申報異常：location 的採用與驗證（目前實作）

> 端點：`POST /api/driver/packages/:packageId/exception`

| 情境 | 你送的 `location` | 寫入的 `package_events.location` | 驗證/限制（拒絕條件） |
|---|---|---|---|
| 包裹仍在車上（有 cargo） | 未提供 | 載貨車的 `TRUCK_*` | 若 cargo 車輛不是你本人 → 403 |
| 包裹仍在車上（有 cargo） | `TRUCK_*` | 載貨車的 `TRUCK_*` | `TRUCK_*` 必須等於載貨車 `vehicle_code`，否則 400 |
| 包裹仍在車上（有 cargo） | 節點 ID | 該節點 ID | 必須等於車輛 `current_node_id`，且需與 active task 節點相關（避免亂填），否則 400/409 |
| 包裹不在車上（無 cargo） | 未提供 | `vehicles.current_node_id`（若無則 fallback `vehicle_code`） | 需能取得/建立司機 vehicle，否則 400 |
| 包裹不在車上（無 cargo） | `TRUCK_*` | 司機 vehicle 的 `vehicle_code` | `TRUCK_*` 必須等於「我的車碼」，否則 400 |
| 包裹不在車上（無 cargo） | 節點 ID | `vehicles.current_node_id` | 必須等於車輛 `current_node_id`，否則 400 |

> 上述規則的目的：避免 `location` 變成「前端任意字串」，確保事件能被追蹤圖正確解讀。

### 4) CS 結案（exception_resolved）：location 的用途（既有規範）

`exception_resolved.location` 主要用於**顧客端 stage 回推**（例如回到 `warehouse_in` 或 `in_transit`），不作為「恢復配送起點」的唯一依據；恢復起點以當下留置位置（車上/站內）決定。

詳見：`docs/handbook/customer-service.md`

## Consistency（異常與任務/事件的一致性）

- 異常成立時，必須同時建立：
  - `package_exceptions` 一筆（異常池）
  - `package_events` 一筆（`delivery_status='exception'`）
- 異常成立後，必須取消該包裹所有 active `delivery_tasks`，讓任務從清單消失。
- 異常未結案時，應阻擋其他會前進流程的事件寫入（回 409）。

## Sources（既有文件）

- `docs/legacy/exception-handling.md`（舊規範/非權威；舊入口：`docs/exception-handling.md`）
- `docs/reference/api/07-exceptions-tasks.md`（API 章節，或從 `docs/api-contract.md` 索引進入）
- `docs/handbook/customer-service.md`（客服流程）
