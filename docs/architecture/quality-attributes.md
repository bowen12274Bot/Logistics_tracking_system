# Non-Functional Requirements as Architecture（品質屬性與非功能需求）

定位聲明：

- 本文件屬於 `docs/architecture/`（L1 概念層），描述系統的「品質屬性（quality attributes）」如何被設計承接：效能、可用性、可擴展性、安全性、易用性。
- 本文件不承載規則權威：規則/一致性約束以 `docs/modules/` 為準；API 介面與 schema 以 `docs/reference/api/` 為準。

需求來源（背景）：

- `UML/TermProject114.md`（2.1～2.5）

---

## 1) 系統品質屬性的責任邊界

本專案採用 Cloudflare（Pages / Workers / D1）部署。品質屬性不是單點保證，而是「平台能力」與「應用設計」共同作用：

- 平台提供：邊緣執行、水平擴展、TLS、託管資料庫等基礎能力
- 專案負責：資料模型選擇、授權邊界、錯誤處理一致性、可觀測性落點、測試/benchmark 與回歸

因此本文件用「架構機制（mechanisms）」描述品質屬性如何被承接，並把“如何驗證”連到 repo 內既有文件/測試入口，避免只用口號。

---

## 2) 效能（Performance）與即時性（Near Real-time）

對應需求：`UML/TermProject114.md` 2.1

本系統的效能設計重點不是“單一頁面很快”，而是讓「追蹤進度」能在高頻事件寫入下仍維持可查詢與可渲染：

- 事件為中心（event as source of truth）：追蹤與流程以 `package_events` 事件為事實來源，讓狀態可追溯、也降低多處同步更新造成的競態風險。
  - 事件模型與資料流：`docs/architecture/event-model-and-flows.md`
  - 追蹤渲染規格（點/線、stage、異常位置）：`docs/modules/tracking.md`
- 查詢面向的可擴展：員工的多條件搜尋屬於“重查詢能力”，以明確的查詢介面承接（避免各頁各寫 SQL）。
  - 介面參考：`docs/reference/api/03-packages.md`
- 驗證方式（本 repo 可落地的證據）：以 benchmark/測試對外給出可重現的量測方法與結果（P95 等）。
  - 測試/benchmark 指南入口：`docs/guides/testing-guide.md`

---

## 3) 可用性（Availability）與可靠性（Reliability）

對應需求：`UML/TermProject114.md` 2.2

本系統把“可用性”分成兩層：平台層的服務可用 + 應用層的「在故障/錯誤時仍可被理解與恢復」。

- 平台層：Cloudflare 提供基礎的高可用與擴展（此為平台能力，不在 repo 內宣稱特定 SLA）。
- 應用層：
  - 事件歷史保留：即使某次流程中斷，事件仍可作為後續恢復/查核的依據（降低“狀態遺失”風險）。
  - 錯誤落點：系統錯誤/異常紀錄具備獨立落點（用於排錯、追查與專題展示“可觀測性”的最小證據）。
    - 表結構總覽：`docs/reference/database-schema.md`
- 驗證方式：以「錯誤情境的回應一致性」與「回歸測試」作為可用性證據，而非只用敘述。
  - API 通用錯誤/授權語意：`docs/reference/api/00-common.md`

---

## 4) 可擴展性（Scalability / Extensibility）

對應需求：`UML/TermProject114.md` 2.3

本系統的可擴展性採用“資料模型先行”的方式：站點、路線、車輛、任務都以資料抽象承接擴展，而不是把規則硬寫死在畫面流程。

- 站點/路網抽象：`nodes`/`edges`（新增站點、調整路徑成本不需要改 UI 流程語意）
  - 規則：`docs/modules/map-routing.md`
  - Schema：`docs/reference/database-schema.md`
- 司機/車輛抽象：`vehicles`/`vehicle_cargo`（新增司機、擴充車輛數量與載貨歷史）
  - 規則：`docs/modules/operations.md`
  - Schema：`docs/reference/database-schema.md`
- 服務與計價：目前以規格化演算法承接（routeCost、箱型、時效、特殊標記），其優點是可測試、可解釋；若需求期待“可配置的運價規則”，則屬於後續可擴展方向。
  - 規則：`docs/modules/pricing.md`

---

## 5) 安全性（Security）與可稽核性（Auditability）

對應需求：`UML/TermProject114.md` 2.4

本系統的安全性重點是「角色邊界一致」與「資料最小揭露」：

- 認證與授權：token + RBAC；角色語意以 `user_class` 為中心，並在前後端一致使用。
  - 規則：`docs/modules/users.md`
- 客戶資料隔離：客戶只能存取自己的包裹與追蹤資料（避免水平越權）。
  - 具體實作：`backend/src/endpoints/packageStatusQuery.ts`
- 異常資訊最小揭露：顧客端追蹤顯示只需知道“異常存在與位置”，不需要取得內部處理報告或細節。
  - 規則：`docs/modules/exceptions.md`
- 稽核（後續建議方向）：若要完整回答“存取日誌”，應形成獨立的審計事件落點（寫入型操作：誰、何時、對哪個資源做了什麼）。

---

## 6) 易用性（Usability）與一致性呈現

對應需求：`UML/TermProject114.md` 2.5

本系統的易用性不是只靠 UI 美術，而是靠「事件語意一致」讓使用者能理解進度：

- 追蹤頁的呈現規格被明確文件化（點/線/異常/stage），用以避免前後端對同一事件的解讀漂移。
  - 規則：`docs/modules/tracking.md`
- UI 與流程的展示材料：
  - UI 規範：`docs/design/ui-spec.md`
  - 關鍵序列圖：`docs/design/sequence-diagrams.md`

---

## Appendix：需求映射（Trace to SRS）

本文件對應 `UML/TermProject114.md` 的非功能性需求條目：

- 2.1 效能 → 本文件第 2 節
- 2.2 可靠性與可用性 → 本文件第 3 節
- 2.3 可擴展性 → 本文件第 4 節
- 2.4 安全性 → 本文件第 5 節
- 2.5 使用便利性 → 本文件第 6 節

