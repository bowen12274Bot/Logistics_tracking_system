# Package Module

> 來源：`docs/legacy/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程（權威）：`docs/modules/shipping.md`、`docs/modules/tracking.md`、`docs/modules/operations.md`、`docs/modules/exceptions.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 3. 包裹管理模組 (Package Module)

### 3.1 建立包裹/寄件 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/packages` |
| **功能** | 建立新包裹寄件單 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer` |

#### 輸入格式 (Request Body)

> 本端點目前同時支援 legacy 與新結構欄位；客戶端 UI 使用「扁平欄位 + 地圖節點 ID」為主。

```json
{
  "sender_name": "string",
  "sender_phone": "string",
  "sender_address": "END_HOME_0 | END_STORE_0",

  "receiver_name": "string",
  "receiver_phone": "string",
  "receiver_address": "END_HOME_1 | END_STORE_1",

  "weight": 1,
  "length": 60,
  "width": 40,
  "height": 40,
  "declared_value": 1000,
  "contents_description": "書籍",

  "delivery_time": "overnight | two_day | standard | economy",
  "payment_type": "prepaid | cod",

  "pickup_date": "YYYY-MM-DD",
  "pickup_time_window": "09:00-12:00 | 12:00-15:00 | 15:00-18:00 | 18:00-21:00",
  "pickup_notes": "string",

  "route_path": "[\"END_HOME_0\",\"REG_0\",\"HUB_0\",\"REG_1\",\"END_STORE_2\"]",
  "metadata": { "pickup_type": "home | store", "destination_type": "home | store" }
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `sender_*` / `receiver_*` | string | ✅ | 寄/收件資訊（地址使用地圖節點 ID，例如 `END_HOME_0` / `END_STORE_0`） |
| `weight` | number | ✅ | 重量（公斤） |
| `length`/`width`/`height` | number | ✅ | 尺寸（公分） |
| `declared_value` | number | ❌ | 申報價值（元），若沒填由系統產生 |
| `contents_description` | string | ❌ | 內容物描述（客戶端 UI 會填） |
| `delivery_time` | string | ✅ | 配送時效：`overnight`/`two_day`/`standard`/`economy` |
| `payment_type` | string | ✅ | 付款責任：`prepaid`/`cod`（到付付款人需能被解析為系統客戶；否則會降級為 `prepaid`） |
| `pickup_*` | string | ❌ | 到府取件欄位（只在 `pickup_type=home` 時使用） |
| `route_path` | string | ❌ | 路徑節點陣列（JSON 字串；多用於追蹤圖/除錯） |

#### 輸出格式 (Success Response - 201)

```json
{
  "success": true,
  "package": {
    "id": "uuid",
    "tracking_number": "TRK-xxxx-xxxxxxxx",
    "status": "created",
    "sender_name": "string",
    "sender_phone": "string",
    "sender_address": "END_HOME_0",
    "receiver_name": "string",
    "receiver_phone": "string",
    "receiver_address": "END_STORE_3",
    "payment_type": "prepaid",
    "payment_method": "cash",
    "created_at": "2025-12-10T00:30:00Z",
    "estimated_delivery": "2025-12-13T00:00:00Z"
  }
}
```
`tracking_number` 在建立包裹後產生。建立包裹後會同步建立一筆待付費用（可在 `GET /api/payments/packages` 查到）。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 輸入資料不完整、地址節點格式錯誤/不存在、或路徑不存在 |
| 401 | 未認證 |
| 500 | 建立失敗 |

---

### 3.2 運費試算 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/packages/estimate` |
| **功能** | 在建立包裹前先試算運費 |
| **認證** | ❌ 不需要（公開 API） |

#### 輸入格式 (Request Body)

```json
{
  "fromNodeId": "END_HOME_0 | END_STORE_0",
  "toNodeId": "END_HOME_1 | END_STORE_1",
  "weightKg": 1.5,
  "dimensionsCm": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "deliveryType": "overnight | two_day | standard | economy",
  "specialMarks": ["fragile", "dangerous", "international"]
}
```

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "estimate": {
    "fromNodeId": "END_HOME_0",
    "toNodeId": "END_STORE_3",
    "route_cost": 5147,
    "route_path": ["END_HOME_0", "REG_0", "HUB_0", "REG_1", "END_STORE_3"],
    "box_type": "M",
    "total_cost": 150,
    "estimated_delivery_date": "2025-12-12"
  }
}
```

> 計價規格權威：`docs/modules/pricing.md`

---

### 3.3 客戶查詢包裹列表 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/packages` |
| **功能** | 查詢客戶自己的包裹列表 |
| **認證** | ✅ 需要 Token |
| **權限** | `customer` 只能查自己的包裹；員工可用 `customer_id` 查指定客戶（暫定政策） |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `customer_id` | string | ❌ | 客戶 ID（僅員工可用；customer 會被忽略並強制改用自己） |
| `limit` | integer | ❌ | 回傳筆數（預設 20） |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "packages": [ ... ]
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 無權查詢（例如 customer 嘗試查他人） |

---

### 3.4 查詢包裹狀態與事件 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/packages/:packageId/status` |
| **功能** | 查詢包裹主檔 + 事件歷史（客戶只能查自己的包裹） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer` 只能查自己的；員工可查所有（暫定政策） |

#### 輸入格式

**Path Parameters:**
- `packageId` (string): 包裹 ID 或追蹤碼

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "package": { "id": "uuid", "tracking_number": "TRK-xxxx-xxxxxxxx", "status": "in_transit" },
  "events": [
    {
      "delivery_status": "created",
      "delivery_details": "託運單已建立，等待司機取件",
      "location": "END_HOME_0",
      "events_at": "2025-12-10T00:30:00Z"
    }
  ],
  "active_exception": null,
  "vehicle": { "id": "uuid", "vehicle_code": "TRUCK_001" }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 嘗試查詢他人的包裹 |
| 404 | 包裹不存在 |

---

### 3.5 公開追蹤查詢 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/tracking/:trackingNumber` |
| **功能** | 依追蹤編號查詢包裹狀態（公開，不需登入） |
| **認證** | ❌ 不需要 |

#### 輸入格式

**Path Parameters:**
- `trackingNumber` (string): 追蹤編號（如 `TRK-xxxx-xxxxxxxx`）

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "tracking_number": "TRK-xxxx-xxxxxxxx",
  "current_status": "in_transit",
  "current_location": "REG_1",
  "updated_at": "2025-12-10T10:30:00Z",
  "estimated_delivery": "2025-12-13T00:00:00Z",
  "events": [
    {
      "status": "created",
      "description": "託運單已建立，等待司機取件",
      "location": "END_HOME_0",
      "timestamp": "2025-12-10T00:30:00Z"
    }
  ]
}
```

#### 事件狀態類型

本系統同時有兩種「狀態」概念：

1. **客戶顯示階段（Stage）**：用於 `packages.status` / API 的 `current_status`，屬於穩定、可用來查詢/篩選的「大階段」。
2. **事件狀態（Event）**：用於 `package_events.delivery_status`，代表真實營運互動/流程事件，可更細緻；系統會把 Event 映射成 Stage 快取。

**Stage（`packages.status` / `current_status`）**

| stage | 說明 |
|------|------|
| `created` | 已建立託運單（等待取件/等待司機） |
| `picked_up` | 已取件上車 |
| `in_transit` | 運輸中（含前往取件/前往站點/站點間運輸） |
| `sorting` | 分揀/轉運處理中 |
| `warehouse_in` | 已入庫/到站 |
| `warehouse_out` | 已出庫/離站 |
| `out_for_delivery` | 末端外送中 |
| `delivered` | 已投遞/簽收 |
| `exception` | 異常（遺失/延誤/損毀） |

**Event（`package_events.delivery_status`）**

> 客戶前端路徑圖的「線段在途」顯示，依賴 `delivery_status='in_transit'` 且 `delivery_details` 可解析目的地（例如：`前往 HUB_0` / `下一站 REG_1`）。

| event | 說明 | 映射到 stage |
|------|------|-------------|
| `created` | 託運單已建立 | `created` |
| `in_transit` | 在途（貨車上/前往下一節點） | `in_transit` |
| `picked_up` | 司機取件上車 | `picked_up` |
| `warehouse_in` | 到站/入庫（司機卸貨完成） | `warehouse_in` |
| `warehouse_received` | 倉儲員確認接收（可選事件） | `warehouse_in` |
| `sorting` | 分揀/轉運處理中 | `sorting` |
| `route_decided` | 倉儲決定下一配送節點/路徑（可選事件） | `sorting` |
| `warehouse_out` | 出庫/離站交接給司機 | `warehouse_out` |
| `out_for_delivery` | 末端外送中（明確標示最後一哩） | `out_for_delivery` |
| `delivered` | 已投遞/簽收完成 | `delivered` |
| `exception` | 異常事件 | `exception` |
| `exception_resolved` | 異常已處理/解除（依 location 推導恢復階段） | `warehouse_in` / `in_transit` |
| `enroute_pickup` | 司機前往取件點（可選通知事件） | `in_transit` |
| `arrived_pickup` | 司機抵達取件點（可選事件） | `in_transit` |
| `payment_collected_prepaid` | 現金預付收款完成（可選事件） | `in_transit` |
| `enroute_delivery` | 司機前往目的地（可選通知事件） | `out_for_delivery` |
| `arrived_delivery` | 司機抵達目的地（可選事件） | `out_for_delivery` |
| `payment_collected_cod` | 現金到付收款完成（可選事件） | `out_for_delivery` |

#### 客戶追蹤圖渲染規則（點/線判定）

> 本節描述「客戶包裹追蹤圖」如何由 `packages.route_path` + `package_events` 推導出節點進度與線段在途狀態（對齊目前前端實作邏輯）。

**輸入資料**
- 節點序列：`packages.route_path`（節點 ID 陣列或以逗號分隔的字串），代表「貨車出發後」的配送路徑（例如：`END_* → REG_* → ... → END_*`）。
- 事件序列：`GET /api/packages/:packageId/status` 回傳的 `events[]`（依 `events_at ASC` 排序）。

**點（Node）到達判定**
- 若某筆事件的 `location` 是路徑中的節點 ID（`route_path` 內），視為「到達該節點」。
- 同一節點可能被多次經過：到達時間以該節點的 **最早** `events_at` 為準（避免後續 pass-by 覆蓋節點時間軸）。

**取件前（出發地）時間軸**
- 若路徑第一個節點（通常是寄件人 `END_*`）在「取件前事件」出現，會用它當作「貨車出發/起點時間」之一的來源。
- 取件前事件判定（相容值）：`delivery_status` 為 `created`/`task_created`/`queued`/`pending_pickup`/`waiting_pickup`，或 `delivery_details` 含類似「託運單已建立/等待司機取件」等字樣。

**線（Segment）在途判定**
- 線段在途只認 `delivery_status='in_transit'` 的事件。
- 該事件需同時滿足：
  - `location` 是 `TRUCK_*`（用於顯示「在路上」的貨車標示）
  - `delivery_details` 可解析出目的地節點 ID（例如：`前往 HUB_0` 或 `下一站 REG_1`）
- 解析到的目的地節點如果在路徑節點序列中，會把該 `TRUCK_*` 綁到「目的地前一段線段」上，作為在途顯示依據。

**異常（Exception）顯示**
- 若事件的 `delivery_status` 為 `exception`（相容值：`abnormal`/`error`/`failed`），前端會將：
  - `location` 若是節點 ID → 標記該節點（點）為異常。
  - `location` 若是 `TRUCK_*` 且 `delivery_details` 可解析目的地 → 標記對應線段（線）為異常。

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 404 | 追蹤編號不存在 |

---

### 3.6 建立貨態事件（內部 API） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `POST /api/packages/:packageId/events` |
| **功能** | 新增包裹追蹤事件（供員工/系統使用） |
| **認證** | ✅ 需要 Token |
| **權限** | `driver`、`warehouse_staff`、`customer_service`、`admin` |

#### 輸入格式

**Path Parameters:**
- `packageId` (string): 包裹 ID

**Request Body:**
```json
{
  "status": "in_transit",
  "description": "已裝載至貨車",
  "location": "TRUCK_001",
  "notes": "string"
}
```

#### 輸入說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | ✅ | 事件狀態（見上方狀態列表） |
| `description` | string | ❌ | 事件詳細描述 |
| `location` | string | ✅ | 包裹當前位置：在地面時為節點 ID（如 `HUB_TAIPEI`）；在車上時為車輛 ID（如 `TRUCK_001`） |
| `notes` | string | ❌ | 備註 |

> 💡 **location 欄位邏輯說明**：
> - 包裹在**倉庫/配送站/超商**等節點時：`location` = 節點 ID（如 `HUB_TAIPEI`、`REG_TAOYUAN`）
> - 包裹在**貨車上運輸中**時：`location` = 車輛 ID（如 `TRUCK_001`）
> - 系統可依據 location 的前綴（`HUB_`、`REG_`、`TRUCK_` 等）判斷位置類型

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "event_id": "uuid",
  "package_status": "in_transit",
  "message": "事件記錄成功"
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 必填欄位缺失、無效的 status 值 |
| 401 | 未認證 |
| 403 | 無權限（customer 無法建立事件） |
| 404 | 包裹不存在 |

---

### 3.7 進階追蹤查詢（員工用） `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/tracking/search` |
| **功能** | 多條件搜尋包裹（員工用） |
| **認證** | ✅ 需要 Token |
| **權限** | `customer_service`、`warehouse_staff`、`admin` |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `tracking_number` | string | ❌ | 追蹤編號 |
| `customer_id` | string | ❌ | 客戶帳號/ID |
| `date_from` | string | ❌ | 運送日期起始 |
| `date_to` | string | ❌ | 運送日期結束 |
| `location_id` | string | ❌ | 位置 ID（節點 ID 或車輛 ID，如 `HUB_TAIPEI` 或 `TRUCK_001`） |
| `status` | string | ❌ | 當前狀態 |
| `exception_only` | boolean | ❌ | 只顯示異常包裹 |

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | customer 或 driver 無權使用 |

---

