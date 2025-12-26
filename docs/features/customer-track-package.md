# 功能：包裹追蹤（Customer Tracking）

本文件描述客戶端「追蹤」的端到端行為：公開追蹤、登入追蹤、路徑圖渲染規格、異常顯示。

## 入口與 UI

- UI：`/customer/track`

## 規則（權威）

- 追蹤顯示規格：`docs/modules/tracking.md`
- 異常規格：`docs/modules/exceptions.md`

## API

- 公開追蹤：`GET /api/tracking/:trackingNumber`（`docs/reference/api/03-packages.md`）
- 登入查狀態與事件：`GET /api/packages/:packageId/status`（`docs/reference/api/03-packages.md`）
- 列表與篩選（客戶端追蹤頁清單來源）：`GET /api/tracking/search`（`docs/reference/api/03-packages.md` 的「進階追蹤查詢」）

## 規格要點（摘要）

- `route_path` 缺失時無法繪製路徑進度。
- `exception_resolved` 不推進顧客可見時間軸。

## 端到端流程（客戶端追蹤頁）

1. 取得清單（配送中 / 歷史）
   - 呼叫 `GET /api/tracking/search?status_group=in_transit`（配送中）
   - 或 `GET /api/tracking/search?status_group=history`（歷史/已完成）
2. 點開某筆包裹 → 取得事件詳情（含 `active_exception`、`vehicle`）
   - 呼叫 `GET /api/packages/:packageId/status`
3.（可選）若只拿到 `tracking_number`，可用公開追蹤查詢
   - 呼叫 `GET /api/tracking/:trackingNumber`

## 列表查詢（GET /api/tracking/search）

> 雖然端點註解寫「員工用」，但現行實作允許 `customer` 呼叫；且當呼叫者是 customer 時，後端會強制把 `customer_id` 綁定為「自己」。

### Query 範例：配送中

`GET /api/tracking/search?status_group=in_transit&exception_only=false`

### Query 範例：歷史（可加日期）

`GET /api/tracking/search?status_group=history&date_from=2025-12-01&date_to=2025-12-31`

> `date_from/date_to` 若用 `YYYY-MM-DD`，後端會自動補成 `T00:00:00Z` / `T23:59:59Z`。

### Query 重要規則

- `location_id` 與 `vehicle_id` 不可同時使用（否則 400）
- `status_group=history`：只回 `delivered` / `delivery_failed`
- `status_group=in_transit`：回所有「尚未完成」的狀態（包含 `exception`）

### Response（清單項目重點欄位）

```json
{
  "success": true,
  "packages": [
    {
      "id": "uuid",
      "tracking_number": "TRK-xxxx-xxxxxxxx",
      "status": "in_transit",
      "customer_id": "uuid",
      "created_at": "2025-12-10T00:30:00Z",
      "sender_name": "王小明",
      "receiver_name": "李小華",
      "estimated_delivery": "2025-12-13T00:00:00Z",
      "delivery_time": "standard",
      "route_path": "[\"END_HOME_0\",\"REG_0\",\"HUB_0\",\"REG_1\",\"END_STORE_3\"]",
      "current_location": "TRUCK_001",
      "current_updated_at": "2025-12-10T10:30:00Z"
    }
  ],
  "total": 1
}
```

## 詳情查詢（GET /api/packages/:packageId/status）

### Path

- `packageId` 可用包裹 ID 或追蹤碼（tracking number）

### Response（摘要）

```json
{
  "success": true,
  "package": { "id": "uuid", "tracking_number": "TRK-xxxx-xxxxxxxx", "status": "in_transit" },
  "events": [
    { "delivery_status": "created", "delivery_details": "託運單已建立，等待司機取件", "location": "END_HOME_0", "events_at": "2025-12-10T00:30:00Z" }
  ],
  "active_exception": null,
  "vehicle": { "id": "uuid", "vehicle_code": "TRUCK_001" }
}
```

### 客戶隱私處理（現行實作）

- 若事件 `delivery_status = exception`，對 customer 會把該事件的 `delivery_details` 清空（避免顯示內部細節）。
- `active_exception.description` 對 customer 也會清空，只保留 `reason_code` 與 `location`。

## 公開追蹤（GET /api/tracking/:trackingNumber）

適用情境：不登入也能用追蹤碼查狀態；回傳欄位較精簡、也不含 `active_exception/vehicle`。

```json
{
  "success": true,
  "tracking_number": "TRK-xxxx-xxxxxxxx",
  "current_status": "in_transit",
  "current_location": "REG_1",
  "updated_at": "2025-12-10T10:30:00Z",
  "estimated_delivery": "2025-12-13T00:00:00Z",
  "events": [
    { "status": "created", "description": "託運單已建立，等待司機取件", "location": "END_HOME_0", "timestamp": "2025-12-10T00:30:00Z" }
  ]
}
```
