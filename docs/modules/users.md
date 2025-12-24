# Users & Access Control（使用者與權限）

本文件定義「身分、角色、token 與 RBAC」的規則層說明；API 介面請見 `docs/reference/api/01-users.md` 與 `docs/reference/api/06-super-user.md`（或從 `docs/api-contract.md` 索引進入）。

## Intent（理念）

- 所有 staff 操作必須可追溯到 `users.id`（由 token 對應）。
- 前端/後端都要用同一套角色語意（以 `user_class` 為主）。

## Roles（角色）

對齊 `docs/api-contract.md`（索引入口）：

- customer：`non_contract_customer` / `contract_customer`
- employee：`driver` / `warehouse_staff` / `customer_service` / `admin`

## Token（認證）

- Bearer token（`Authorization: Bearer <token>`）
- 權威來源：`tokens` 表（token → user_id）

## RBAC（授權）

- 規則：端點以 `user.user_class`（必要時含 `user_type`）判斷是否允許。
- 站點綁定：員工的 `users.address` 是工作站點/所屬節點的權威資料來源（倉儲尤其重要）。

## Links

- API：`docs/reference/api/01-users.md`、`docs/reference/api/06-super-user.md`
- 操作模組與站點綁定：`docs/modules/operations.md`
