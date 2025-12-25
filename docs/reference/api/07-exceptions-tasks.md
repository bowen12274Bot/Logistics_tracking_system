# Exceptions & Tasks

> 來源：`docs/reference/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/exceptions.md`、`docs/modules/operations.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 7. 異常與任務模組 (Exceptions & Tasks) `[大部分已實作]`

> 本章節為配合 `todoList.md` 新增的「異常池 / 司機任務 / 司機車輛移動 / 倉儲改路徑」需求。大部分 API 已實作完成。
>
> **相關詳細規範文件**：
> - `docs/modules/exceptions.md`：異常模組（location 權威/驗證、封鎖規則、與 tasks/events 的一致性）
> - `docs/legacy/exception-handling.md`：異常規範（舊規範/非權威；舊入口：`docs/exception-handling.md`；若衝突以 `docs/modules/exceptions.md` 為準）
> - `docs/handbook/customer-service.md`：客服異常處理流程


### 7.1 異常池（客服） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/cs/exceptions` |
| **功能** | 異常池列表（未處理/已處理） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `handled` | boolean | ❌ | 是否已處理；不帶時預設只列未處理（handled=0） |
| `limit` | number | ❌ | 預設 50，最大 200 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "exceptions": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "tracking_number": "TRK-xxxx",
      "package_status": "exception",
      "reason_code": "string|null",
      "description": "string",
      "reported_by": "user_id",
      "reported_role": "driver|warehouse_staff|customer_service",
      "reported_at": "2025-12-10T00:30:00Z",
      "handled": 0,
      "handled_by": null,
      "handled_at": null,
      "handling_report": null
    }
  ]
}
```

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/cs/exceptions/:exceptionId/handle` |
| **功能** | 將異常標示已處理並填寫處理報告 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### 輸入格式

**Path Parameters:**
- `exceptionId` (string): 異常紀錄 ID（`package_exceptions.id`）

**Request Body:**
```json
{
  "action": "resume | cancel",
  "handling_report": "string",
  "location": "HUB_0 | REG_1 | TRUCK_0 | END_HOME_1"
}
```

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `action` | string | ✅ | `resume`=解除異常並恢復配送流程（後續由倉儲重新派送任務）；`cancel`=取消委託（同時取消所有 active 任務段） |
| `handling_report` | string | ✅ | 處理報告 |
| `location` | string | ❌ | 用於事件定位與客戶追蹤圖顯示（建議填 HUB/REG 表示回到站點） |

#### 行為說明
- 會將 `package_exceptions.handled` 設為 1 並寫入 `handling_report`。
- 會新增一筆 `package_events`：`delivery_status='exception_resolved'`。
- 若 `action='cancel'`：會把該包裹所有 active 任務段（`pending/accepted/in_progress`）標記為 `canceled`，讓司機/倉儲清單立即消失。

### 7.2 異常申報（司機/倉儲） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/exception` |
| **功能** | 司機異常申報：建立異常紀錄並將包裹狀態更新為 `exception`（同時寫入事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 輸入格式 (Request Body)
```json
{
  "reason_code": "string",
  "description": "string",
  "location": "TRUCK_0 | END_HOME_1 | REG_1 | HUB_0"
}
```

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `description` | string | ✅ | 異常描述（會寫入異常池與事件） |
| `reason_code` | string | ❌ | 異常分類代碼（由 UI 選單選擇；本專案 driver/warehouse_staff 必填） |
| `location` | string | ❌ | 異常發生位置：節點 ID（點異常）或 `TRUCK_*`（線異常） |

#### reason_code 建議值（輕量規範）

> 本專案以「選單」呈現並要求司機/倉儲員必填；客服/管理端可擴充更多分類而不破壞既有資料。

| reason_code | 說明 |
|------------|------|
| `lost` | 遺失 / 找不到包裹 |
| `damaged` | 損毀 / 外箱破損 |
| `unpaid` | 未付款 / 付款爭議 |
| `sender_not_ready` | 寄件者未備妥包裹 |
| `no_answer` | 客戶未應門 / 無法聯絡 |
| `refused` | 收件者拒收 |
| `address_issue` | 地址問題 / 無法送達 |
| `label_issue` | 標籤 / 面單問題（倉儲） |
| `misroute` | 錯分 / 送錯站（倉儲） |
| `other` | 其他（搭配 description 詳細說明） |

**格式建議**
- 使用小寫 snake_case（例如 `address_issue`）。
- 若未知/不適用：不填即可，改以 `description` 描述。

#### 行為說明（重要）
- 異常必須同時建立：
  - `package_exceptions` 一筆（異常池）
  - `package_events` 一筆：`delivery_status='exception'`
- 異常申報後，系統會把該包裹的 active 任務段（`pending/accepted/in_progress`）取消，讓任務從司機/倉儲清單消失。

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/exception` |
| **功能** | 倉儲異常申報：建立異常紀錄並將包裹狀態更新為 `exception`（同時寫入事件） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

#### 異常事件規範（客戶追蹤圖相容）
- `delivery_status='exception'`：
  - `delivery_details` 必須有可讀描述（對應 `description`）。
  - `location` 建議必填：
    - 節點 ID（`END_*/REG_*/HUB_*`）→ 前端標記「點」異常
    - `TRUCK_*` + `delivery_details` 含目的地（`前往 XXX`/`下一站 XXX`）→ 前端標記「線」異常
- `delivery_status='exception_resolved'`：
  - 僅應由客服處理端點產生（`POST /api/cs/exceptions/:exceptionId/handle`），避免「解除事件」與異常池狀態不一致。

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/warehouse/exceptions` |
| **功能** | 倉儲異常申報紀錄列表（僅回傳自己 reported 的 warehouse_staff 紀錄） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

### 7.3 司機任務與車輛移動 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/accept` |
| **功能** | 司機接受/開始任務（任務狀態推進） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/tasks/:taskId/complete` |
| **功能** | 司機完成任務：推進包裹貨態、到付可回報實收，包裹上車時所在地可更新為貨車編號 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/driver/vehicle` |
| **功能** | 取得司機車輛狀態（home/current/vehicle_code） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/vehicle/move` |
| **功能** | 司機在地圖上移動到相鄰節點（後端檢查 `edges` 相鄰） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

### 7.4 倉儲改路徑 `[規劃中]`

| 項目 | 說明 |
|------|------|
| **位置** | `PATCH /api/warehouse/packages/:packageId/route` |
| **功能** | 以系統計算路徑為建議，允許倉儲員修改包裹後續配送路徑（更新 `packages.route_path`） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

---

