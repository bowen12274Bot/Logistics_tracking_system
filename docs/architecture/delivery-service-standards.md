# 包裹運費規範（以地圖 routeCost 計價）

> 本文件以地圖路線的 `routeCost`（edges `cost` 加總）作為運費的主要變數，不再使用 Zone / distanceKm 分級。

> **[狀態說明]**: 本文件為 **規劃與演算法規範**。目前後端尚未完整實作此動態計價邏輯 (對應 Task S3, S4)。現行 `POST /api/packages` 僅支援基礎的寫入，運費計算仍為前端或簡易版邏輯。

## 【0】規則重點（必須符合）

1. 運費使用地圖路線 `routeCost` 計價（由 edges `cost` 加總而來）。
2. `specialMarks` 可疊加（同時有多個標記就累加/加乘相對應的規則）。
3. BoxType 判定需同時考慮「尺寸」與「計費重量（實重/材積重取大）」。
4. 防呆：設定最低運費（price floor）與最高運費上限（price cap）。

## 【1】客戶輸入資料（運費試算）

客戶提供（必要）：

- `fromNodeId`：起始點（地圖節點 ID）
- `toNodeId`：目的地（地圖節點 ID）
- `weightKg`：實重（kg）
- `lengthCm` / `widthCm` / `heightCm`：長寬高（cm）
- `deliveryType`：`overnight` / `two_day` / `standard` / `economy`
- `specialMarks`：`string[]`，可包含 `dangerous` / `fragile` / `international`（可空陣列）

系統推導（不需要客戶填）：

- `routeCost`：呼叫 `/api/map/route` 取得 `route.total_cost`
- `routePath`：同上 API 的 `route.path`（可用於展示/除錯，不影響計價）

## 【2】routeCost：定義、合理範圍、Normalization

### 【2.1】routeCost 代表什麼

`routeCost` 是「路線綜合成本」：將路徑上每一條 edge 的 `cost` 加總（Dijkstra 最短路徑的 `total_cost`）。

在目前的地圖資料（`backend/migrations/0007_virtual_map_seed.sql`）中，edge `cost` 與 `distance`、`road_multiple` 相關，可視為「距離 × 路況倍率」的綜合權重，因此 `routeCost` 更接近：

- 距離（distance）的替代指標
- 路況/繞路造成的時間或成本（road_multiple）的替代指標
- 兩者的綜合權重（不是純距離、也不是純時間）

### 【2.2】常見區間（P50 / P90）

以下數值以「實際配送場景」統計：`fromNodeId = HUB_*` → `toNodeId = END_*` 的最短路徑 `route.total_cost` 分佈（也就是最短路徑上多條 edges `cost` 的加總，不是單一 edge 的 cost）。

- `min` ≈ 2,052
- `P50` ≈ 5,147
- `P90` ≈ 6,993
- `P99` ≈ 7,665
- `max` ≈ 7,906

> 若地圖資料更新（新增節點/調整道路倍率），需重新計算分佈並更新下方 normalization 常數 `K`、以及 floor/cap。

### 【2.3】Normalization（routeCost / K）

因為 `routeCost` 原始尺度較大，計價時先正規化：

- `K = 5200`（建議取地圖的 `P50`）
- `routeCostNorm = routeCost / K`
- 防呆：`routeCostNorm = clamp(routeCostNorm, 0.30, 1.60)`（避免極端值影響過大）

## 【3】配送型態（四種）與 multiplier（校準版）

配送型態用「價格係數」表示（越快越貴），用於 `shipping = ceil(base * serviceMultiplier)`：

| deliveryType | 說明 | `serviceMultiplier` |
| --- | --- | ---: |
| `economy` | 經濟（最便宜） | 1.00 |
| `standard` | 標準 | 1.25 |
| `two_day` | 兩日 | 1.55 |
| `overnight` | 隔夜（最快） | 2.00 |

校準原則：

- 係數差距必須明顯：`overnight > two_day > standard > economy`
- 但不極端：避免 overnight 造成價格翻倍以上且超出 cap 的機率過高

## 【4】BoxType：尺寸 + 計費重量 + 同箱型重量連續加價

### 【4.1】材積重（Volumetric Weight）

- 材積（cm³）= `lengthCm * widthCm * heightCm`
- 材積重（kg）= `材積 / 6000`
- 計費重量（billableWeightKg）= `max(weightKg, volumetricWeightKg)`

### 【4.2】箱型規格（判定門檻）

| BoxType | 尺寸上限（cm） | 計費重量上限 |
| --- | --- | --- |
| 信封 | 最長邊 ≤ 30，厚 ≤ 2 | ≤ 0.5 kg |
| 小型箱 S | 40 × 30 × 20 | ≤ 5 kg |
| 中型箱 M | 60 × 40 × 40 | ≤ 20 kg |
| 大型箱 L | 90 × 60 × 60 | ≤ 50 kg |

### 【4.3】BoxType 判定方式（同時看尺寸與重量）

1. 計算 `billableWeightKg`。
2. 尺寸正規化：把三邊排序成 `d1 >= d2 >= d3`。
3. 信封厚度定義：`thickness = d3`（最短邊視為厚度）。
4. 由小到大挑選第一個「同時符合」的箱型：
   - 信封：`d1 <= 30` 且 `thickness <= 2` 且 `billableWeightKg <= 0.5`
   - S：`d1<=40` 且 `d2<=30` 且 `d3<=20` 且 `billableWeightKg<=5`
   - M：`d1<=60` 且 `d2<=40` 且 `d3<=40` 且 `billableWeightKg<=20`
   - L：`d1<=90` 且 `d2<=60` 且 `d3<=60` 且 `billableWeightKg<=50`
5. 若都不符合 → 服務不適用。

### 【4.4】重量連續加價（同一 BoxType 內）

在同一箱型內，若 `billableWeightKg` 超過「基準重量」，每超過 1 kg 加價 `+X`（向上取整 kg）：

`weightSurcharge = max(0, ceil(billableWeightKg - includedWeightKg)) * perKgFee`

| BoxType | includedWeightKg（含在基本費用內） | perKgFee（每超 1 kg 加價） |
| --- | ---: | ---: |
| 信封 | 0.5 | 0 |
| S | 3 | 18 |
| M | 10 | 15 |
| L | 25 | 12 |

## 【5】特殊標記（可疊加；國際件改 multiplier）

### 【5.1】dangerous / fragile（加法疊加）

| Mark | 說明 | 加價 |
| --- | --- | ---: |
| `dangerous` | 危險品 | +120 |
| `fragile` | 易碎品 | +60 |

### 【5.2】international（改 multiplier）

`international` 不再使用固定加價，改為乘數：

- `internationalMultiplier = 1.80`
- 若 `specialMarks` 包含 `international`：`internationalized = ceil(subtotal * internationalMultiplier)`

> `international` 代表跨境流程/風險與成本比例性上升，因此用 multiplier 讓長路線也會更貴，短路線也不會被固定加價過度放大。

## 【6】以 routeCost 重新訂價（含 floor / cap）

### 【6.1】基礎運費（BoxType × routeCostNorm）

先算基礎成本（未含時效、重量連續加價、特殊標記）：

`base = baseFee + routeCostNorm * ratePerCost`

| BoxType | `baseFee` | `ratePerCost` |
| --- | ---: | ---: |
| 信封 | 30 | 90 |
| S | 70 | 170 |
| M | 110 | 260 |
| L | 160 | 380 |

### 【6.2】最低運費（price floor）

避免 `routeCost` 太小導致運費過低或 0 元：

`finalPrice = max(calculatedPrice, minPrice)`

`minPrice` 建議依箱型與時效設定：

| BoxType | economy | standard | two_day | overnight |
| --- | ---: | ---: | ---: | ---: |
| 信封 | 50 | 70 | 90 | 120 |
| S | 120 | 160 | 210 | 280 |
| M | 200 | 260 | 340 | 450 |
| L | 320 | 420 | 550 | 750 |

### 【6.3】最高運費上限（price cap）

避免地圖異常或極端路徑導致價格爆炸：

`finalPrice = min(finalPrice, maxPrice)`

`maxPrice` 可依箱型與時效設定不同 cap：

| BoxType | economy | standard | two_day | overnight |
| --- | ---: | ---: | ---: | ---: |
| 信封 | 400 | 550 | 700 | 950 |
| S | 900 | 1200 | 1500 | 1900 |
| M | 1400 | 1850 | 2350 | 2900 |
| L | 2200 | 2900 | 3700 | 4600 |

### 【6.4】完整計算流程（建議實作順序）

1. 用 `fromNodeId` / `toNodeId` 呼叫 `/api/map/route`，取得 `routeCost`
2. `routeCostNormRaw = routeCost / K`
3. `routeCostNorm = clamp(routeCostNormRaw, 0.30, 1.60)`
4. `volumetricWeightKg = (lengthCm * widthCm * heightCm) / 6000`
5. `billableWeightKg = max(weightKg, volumetricWeightKg)`
6. 由尺寸 + `billableWeightKg` 判定 `boxType`
7. `base = baseFee[boxType] + routeCostNorm * ratePerCost[boxType]`
8. `shipping = ceil(base * serviceMultiplier[deliveryType])`
9. `weightSurcharge = max(0, ceil(billableWeightKg - includedWeightKg[boxType])) * perKgFee[boxType]`
10. `subtotal = shipping + weightSurcharge`
11. 若含 `international`：`subtotal = ceil(subtotal * internationalMultiplier)`
12. `markFee = (dangerous?120:0) + (fragile?60:0)`
13. `calculatedPrice = subtotal + markFee`
14. `finalPrice = min(max(calculatedPrice, minPrice[boxType][deliveryType]), maxPrice[boxType][deliveryType])`

> 取整規則：`ceil()` 向上取整到整數。

## 【7】範例（以 seed 地圖的典型 routeCost）

### 範例 1：P50 路線 + 重量加價 + 國際件 multiplier

- `routeCost = 5147`（約 P50）
- `K = 5200` → `routeCostNormRaw ≈ 0.99` → `routeCostNorm ≈ 0.99`
- 尺寸 `60×40×40`、`weightKg=12` → `boxType=M`、`billableWeightKg≈12`
- `deliveryType=standard`
- `specialMarks=["international","fragile"]`

計算：

- `base = 110 + 0.99×260 ≈ 367.4`
- `shipping = ceil(367.4×1.25) = 460`
- `weightSurcharge = ceil(12-10)×15 = 30`
- `subtotal = 490` → international → `ceil(490×1.8)=882`
- `markFee = fragile 60`
- `calculatedPrice = 942`
- `finalPrice = min(max(942, minPrice[M][standard]=260), maxPrice[M][standard]=1850) = 942`

## 【8】相關 API

- 路線成本（Dijkstra）：`/api/map/route?from=<nodeId>&to=<nodeId>`
