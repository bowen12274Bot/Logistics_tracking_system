# 功能：管理員人員與 RBAC（Admin User Management）

本文件描述管理員的員工帳號管理、角色指派、站點綁定、車輛指派等端到端能力。

## 規則（權威）

- `docs/modules/users.md`
- `docs/modules/operations.md`

## API

- `docs/reference/api/06-super-user.md`

## 端到端能力清單（依現行後端路由）

> 下列端點皆需 `admin` Token（Bearer）。

### 員工帳號

- 建立員工：`POST /api/admin/users`
- 查詢列表：`GET /api/admin/users`（可用 `user_type/user_class/status/search/limit/offset` 篩選）
- 取得詳情：`GET /api/admin/users/:id`
- 更新資料：`PUT /api/admin/users/:id`
- 停用：`POST /api/admin/users/:id/suspend`
- 啟用：`POST /api/admin/users/:id/activate`
- 刪除：`DELETE /api/admin/users/:id`（會把 status 設成 `deleted` 並清掉 token）
- 重設密碼：`POST /api/admin/users/:id/reset-password`

### 司機與車輛

- 指派車輛：`POST /api/admin/users/:id/assign-vehicle`
  - 僅能對 `user_class=driver` 使用
  - `vehicle_code` 需唯一（同一車號不可被其他司機占用）
  - `home_node_id` 未提供時會使用該司機的 `users.address`
- 工作統計（目前為固定回傳的簡易統計）：`GET /api/admin/users/:id/work-stats`

## Request / Response（具體範例）

### 1) 建立員工帳號

```json
{
  "user_name": "王小明",
  "email": "driver01@example.com",
  "password": "password123",
  "phone_number": "0912-345-678",
  "address": "HUB_0",
  "user_class": "driver"
}
```

### 2) 指派車輛（給司機）

```json
{ "vehicle_code": "TRUCK_001", "home_node_id": "HUB_0" }
```

錯誤範例（摘要）：

- 409：使用者不是司機 / 車輛編號已被使用
- 400：`home_node_id` 無效或缺失

### 3) 工作統計（目前為固定回傳）

```json
{
  "success": true,
  "user_id": "uuid",
  "user_class": "driver",
  "stats": { "tasks_completed": 0, "packages_processed": 0, "exceptions_reported": 0 }
}
```
