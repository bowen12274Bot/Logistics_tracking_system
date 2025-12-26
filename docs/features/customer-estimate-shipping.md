# 功能：運費試算（Shipping Estimate）

本文件描述客戶端「運費試算」的端到端行為：輸入、計價規格、回傳內容，以及 `route_path` 的用途。

## 入口與 UI

- UI：`/customer/send`（試算區塊）

## 規格（權威）

- 計價規格：`docs/modules/pricing.md`

## API

- `POST /api/packages/estimate`：`docs/reference/api/03-packages.md`

## 重要說明

- 本專案地址使用地圖節點 ID（例如 `END_HOME_0` / `END_STORE_0`）。
- `route_path` 可用於追蹤圖/除錯/展示，不直接代表每一步都已發生。

## Request（實際送出欄位）

```json
{
  "fromNodeId": "END_HOME_0",
  "toNodeId": "END_STORE_3",
  "weightKg": 2.5,
  "dimensionsCm": { "length": 60, "width": 40, "height": 40 },
  "deliveryType": "standard",
  "specialMarks": ["fragile"]
}
```

欄位語意：

- `fromNodeId` / `toNodeId`：地圖節點 ID
- `dimensionsCm`：以 cm 表示的長寬高（用於 BoxType 與材積重）
- `deliveryType`：`overnight | two_day | standard | economy`
- `specialMarks`：`dangerous | fragile | international`（可疊加）

## Response（重點欄位）

```json
{
  "success": true,
  "estimate": {
    "route_cost": 5147,
    "route_path": ["END_HOME_0", "REG_0", "HUB_0", "REG_1", "END_STORE_3"],
    "box_type": "M",
    "total_cost": 150,
    "estimated_delivery_date": "2025-12-12"
  }
}
```

## 常見錯誤與排查

- 404（Route Not Found）：起點/終點節點不存在或地圖無路徑（後端會回傳 `reason` 與 debug 欄位）
- 400（Bad Request）：尺寸/重量為非正數，或計價規格判定「服務不適用」（例如超規格箱型）
