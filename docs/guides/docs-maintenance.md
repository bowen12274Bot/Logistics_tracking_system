# Docs 維護規範（Documentation Maintenance）

本文件定義 `docs/` 的維護慣例：如何新增/修改文件、放在哪一層、如何避免規格分裂與連結失效。

---

## 1. 分層與定位（新增文件前先選層）

- `docs/architecture/`：概念層（不變量、責任邊界、核心名詞）
- `docs/modules/`：規則層（單一規則單一來源；一致性約束、資料落點、封鎖條件）
- `docs/reference/`：可查詢參考（接口參考、錯誤碼、資料字典等；不放複雜流程規則）
- `docs/handbook/`：角色手冊（UI/操作步驟與驗收點；不承載規則權威）
- `docs/design/`：設計備忘（UI/UX、原型、提案；不承載規則權威）
- `docs/guides/`：開發/測試/部署/協作指南
- `docs/legacy/`：舊版文件（不再更新，且不作為規格權威來源）

---

## 2. 權威來源規則（避免分裂）

- 規則/流程：只寫在 `docs/modules/`（其他文件只能引用連結，不重寫同一條規則）
- 接口參考：只寫在 `docs/reference/api/`（必要時連回對應 `docs/modules/*` 規則）
- 角色操作：只寫在 `docs/handbook/`（只描述「怎麼做」，規則連結到 `docs/modules/*`）
- 舊文件：放 `docs/legacy/`（可保留作歷史背景，但需標註「非權威」）

---

## 3. 檔名與路徑慣例

- 子資料夾內新增文件請用 kebab-case（例：`driver-map.md`、`delivery-service-standards.md`）
- 既有舊路徑若已對外引用，搬移時保留原檔名作「舊入口 stub」即可

---

## 4. 搬移/改名文件的規範（必做 stub）

若要移動或改名文件：

1. 將全文搬到新路徑
2. 在舊路徑保留 stub（短文說明「已移轉」並附上新路徑）
3. 更新所有引用（至少包含 `docs/README.md` 與相關模組/索引）

---

## 5. 連結與內容格式

- 連結一律使用 repo 相對路徑（例：`docs/modules/exceptions.md`）
- 文件開頭若有「定位聲明」，需寫清楚：本文件層級、是否權威、衝突時以哪裡為準
- 避免使用「重構中/暫行」等模糊狀態字眼；用「權威來源」與「舊入口/舊規範」替代

---

## 6. 新增規範時的最小清單（Checklist）

- [ ] 選定層級：`architecture` / `modules` / `reference` / `handbook` / `design` / `guides`
- [ ] 若是規則：寫在 `docs/modules/`，並在需要被查找處加上連結（例如 `docs/README.md`、相關 `docs/reference/api/*.md`）
- [ ] 若變更/新增端點：更新 `docs/reference/api/*.md` 與 `docs/api-contract.md`（索引）
- [ ] 若搬移文件：保留 stub + 更新引用
