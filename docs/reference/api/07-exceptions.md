# Exceptions API（異常）

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程（權威）：`docs/modules/exceptions.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 7. 異常模組（Exceptions）`[已實作]`

### 7.1 異常池（客服）`[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/cs/exceptions` |
| **功能** | 異常池列表（未處理/已處理） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### Query

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `handled` | boolean | ❌ | 是否已處理；不帶時預設只列未處理（handled=0） |
| `limit` | number | ❌ | 預設 50，最大 200 |

#### Success (200)

```json
{
  "success": true,
  "exceptions": [
    {
      "id": "uuid",
      "package_id": "uuid",
      "tracking_number": "TRK-xxxx-xxxxxxxx",
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

---

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/cs/exceptions/:exceptionId/handle` |
| **功能** | 結案異常：resume（恢復配送）或 cancel（取消委託/銷毀） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service` |

#### Path

- `exceptionId`：`package_exceptions.id`

#### Request body（摘要）

```json
{
  "action": "resume | cancel",
  "handling_report": "string",
  "resume_mode": "continue_segment | reroute_next_hop | redirect_destination",
  "next_hop_override": "REG_1 | HUB_0",
  "destination_override": "END_HOME_0 | END_STORE_0",
  "location": "HUB_0 | REG_1 | TRUCK_0 | END_HOME_1"
}
```

#### 行為摘要（重點）

- 會將 `package_exceptions.handled` 設為 1 並寫入處理報告與決策欄位
- 會新增一筆 `package_events.exception_resolved`
- 若 `action='cancel'`：
  - 會取消所有 active 任務段（`delivery_tasks`）並新增 `delivery_failed` 事件，包裹進入 terminal
- 若 `action='resume'`：
  - 視 `resume_mode` 決定是否沿用上一次段落、指定下一跳、或改目的地；必要時會建立新的 `delivery_tasks`

### 7.2 異常申報（司機/倉儲）`[已實作]`

#### 7.2.1 司機申報

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/driver/packages/:packageId/exception` |
| **功能** | 司機異常申報（建立異常池紀錄 + 寫入 exception 事件 + 取消 active tasks） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

Request body（摘要）：

```json
{
  "reason_code": "string",
  "description": "string",
  "location": "TRUCK_0 | END_HOME_1 | REG_1 | HUB_0"
}
```

#### 7.2.2 司機 - 我的異常申報紀錄

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/driver/exceptions` |
| **功能** | 取得「我（driver）」曾申報的異常紀錄列表 |
| **認證** | ✅ 需要 Token |
| **權限** | `driver` |

#### 7.2.3 倉儲申報

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/warehouse/packages/:packageId/exception` |
| **功能** | 倉儲異常申報（建立異常池紀錄 + 寫入 exception 事件 + 取消 active tasks） |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

Request body（摘要）：

```json
{
  "reason_code": "string",
  "description": "string"
}
```

#### 7.2.4 倉儲 - 我的異常申報紀錄

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/warehouse/exceptions` |
| **功能** | 取得「我（warehouse_staff）」曾申報的異常紀錄列表 |
| **認證** | ✅ 需要 Token |
| **權限** | `warehouse_staff` |

