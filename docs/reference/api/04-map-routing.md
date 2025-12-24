# Map & Routing

> 來源：`docs/reference/api-contract.legacy.md`（由 legacy 拆分）
>
> - 本頁定位：接口參考（endpoint / request/response schema / error codes）
> - 規則/流程：`docs/modules/map-routing.md`
> - 若內容與現行實作衝突：以後端實作與 `docs/modules/` 為準

## 4. 地圖與路線模組 (Map & Routing)

### 4.1 取得地圖節點與邊 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/map` |
| **功能** | 取得虛擬地圖的所有節點與連線 |
| **認證** | ❌ 不需要 |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "nodes": [
    {
      "id": "HUB_TAIPEI",
      "name": "台北轉運中心",
      "type": "hub",
      "level": 1,
      "subtype": null,
      "x": 100,
      "y": 200
    }
  ],
  "edges": [
    {
      "id": 1,
      "source": "HUB_TAIPEI",
      "target": "REG_TAOYUAN",
      "distance": 40.5,
      "cost": 100
    }
  ]
}
```

#### 節點類型

| type  | level | 說明                         |
|-------|-------|------------------------------|
| `HUB` | 1     | 轉運中心（第一層樞紐節點）   |
| `REG` | 2     | 區域節點（第二層區域中心）   |
| `END` | 3     | 終端節點（住家／超商） |


---

### 4.2 路線成本計算 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `GET /api/map/route` |
| **功能** | 計算兩點之間的路線成本 |
| **認證** | ❌ 不需要 |

#### 輸入格式 (Query Parameters)

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `from` | string | ✅ | 起點節點 ID |
| `to` | string | ✅ | 終點節點 ID |

#### 輸出格式 (Success Response - 200)

```json
{
  "success": true,
  "route": {
    "from": "HUB_TAIPEI",
    "to": "REG_KAOHSIUNG",
    "path": ["HUB_TAIPEI", "HUB_TAICHUNG", "REG_KAOHSIUNG"],
    "total_cost": 450
  }
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 400 | 缺少 from 或 to 參數 |
| 404 | 起點或終點節點不存在 |

---

### 4.3 更新地圖邊資料 `[已實作]`

| 項目 | 說明 |
|------|------|
| **位置** | `PUT /api/map/edges/:id` |
| **功能** | 更新路段的成本 |
| **認證** | ✅ 需要 Token |
| **權限** | `admin` |

#### 輸入格式 (Request Body)

```json
{
  "cost": 150
}
```

#### 錯誤回應

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未認證 |
| 403 | 非 admin 無權限 |
| 404 | Edge 不存在 |

---

