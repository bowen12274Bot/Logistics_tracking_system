# 貢獻指南 (Contributing Guide)

本文件說明如何參與物流追蹤系統的開發協作。

---

## 🌿 分支策略 (Branch Strategy)

### 主要分支 (Main Branches)

| 分支 | 說明 |
|------|------|
| `main` | 穩定版本，隨時可部署 |
| `develop` | 開發分支，整合新功能（若有） |

### 功能分支 (Feature Branches)

建立功能分支時，請遵循以下命名規則：

```
feature/[功能描述]
bugfix/[問題描述]
hotfix/[緊急修復描述]
```

**範例：**

```powershell
# 新增功能
git checkout -b feature/add-package-tracking-ui

# 修復 Bug
git checkout -b bugfix/fix-login-validation

# 緊急修復
git checkout -b hotfix/fix-auth-token-expiry
```

---

## 📝 Commit Message 規範

### 格式 (Format)

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 類型 (Types)

| 類型 | 說明 |
|------|------|
| `feat` | 新功能 (new feature) |
| `fix` | 修復 Bug (bug fix) |
| `docs` | 文件變更 (documentation) |
| `style` | 格式調整，不影響程式邏輯 (formatting) |
| `refactor` | 重構，不新增功能也不修復 Bug |
| `test` | 新增或修改測試 |
| `chore` | 建構程序或輔助工具的變動 |

### 範例 (Examples)

```
feat(packages): 新增運費試算 API

- 實作 POST /api/packages/estimate
- 支援尺寸、重量、距離計算
- 新增對應測試案例

Closes #123
```

```
fix(auth): 修復登入時密碼驗證邏輯

密碼比對使用錯誤的 Hash 演算法，
導致部分使用者無法登入。

Fixes #456
```

```
docs(readme): 更新專案結構說明

- 新增 endpoints 目錄結構
- 新增測試檔案說明
- 修正過時的指令範例
```

---

## 🔄 Pull Request 流程 (PR Workflow)

### 1. 建立分支並開發

```powershell
# 從 main 建立功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 2. 開發並 Commit

```powershell
# 開發...
git add .
git commit -m "feat(scope): 描述"
```

### 3. 推送分支

```powershell
git push origin feature/your-feature-name
```

### 4. 建立 Pull Request

1. 前往 GitHub 專案頁面
2. 點擊「Compare & pull request」
3. 填寫 PR 描述（參考下方範本）
4. 指派 Reviewer（若有）

### PR 描述範本 (Template)

```markdown
## 變更內容 (Changes)

- 新增 XXX 功能
- 修改 YYY 邏輯
- 移除 ZZZ 程式碼

## 相關 Issue

Closes #123

## 測試方式 (Testing)

- [ ] 本地測試通過 (`npm test`)
- [ ] 手動測試相關功能
- [ ] 確認無新的 TypeScript 錯誤

## 截圖（若有 UI 變更）

<!-- 貼上截圖 -->
```

---

## 👀 Code Review 規範

### Reviewer 職責

1. **程式碼品質**：檢查邏輯正確性、可讀性、效能
2. **規範遵守**：確認遵守專案慣例與程式碼風格
3. **測試覆蓋**：確認有適當的測試案例
4. **文件更新**：確認相關文件已同步更新

### Review 留言慣例

| 前綴 | 說明 | 必須修改 |
|------|------|----------|
| `[blocking]` | 阻擋性問題，必須修改 | ✅ |
| `[suggestion]` | 建議改進，可選擇性採用 | ❌ |
| `[question]` | 提問，需要解釋 | ❌ |
| `[nit]` | 小細節，非必要 | ❌ |

**範例：**

```
[blocking] 這裡的 SQL 查詢可能有 SQL Injection 風險

[suggestion] 可以考慮把這段邏輯抽成獨立函式

[question] 這個判斷條件的意圖是什麼？

[nit] 建議把變數名稱改成更具描述性的
```

---

## 🚫 禁止事項 (Don'ts)

### ❌ 禁止 Force Push

```powershell
# 請不要這樣做！
git push -f origin main
git push --force-with-lease origin main
```

Force Push 會讓 commit 歷史消失，造成其他開發者的困擾。

### ❌ 禁止直接推送到 main

```powershell
# 請不要這樣做！
git push origin main
```

請一律透過 Pull Request 合併。

### ❌ 禁止 Commit 機敏資訊

- API Keys
- 密碼
- 個人資料
- `.env` 檔案內容

---

## ✅ 提交前檢查清單 (Pre-Commit Checklist)

開 PR 之前，請確認：

- [ ] 程式碼可正常執行（`npm run dev`）
- [ ] 測試全數通過（`npm test`）
- [ ] 無 TypeScript 錯誤
- [ ] Commit Message 符合規範
- [ ] 相關文件已更新
- [ ] 無 console.log 遺留（除非必要）

---

## 🚀 CI/CD 自動化流程

### GitHub Actions 工作流程

本專案已設定 GitHub Actions 自動化測試與部署。

### 自動執行項目

當推送或合併到 `main` 分支時，會自動：

1. ✅ 執行後端測試（95 個案例）
2. ✅ 執行前端測試
3. 🚀 測試通過後自動部署到 Cloudflare
   - 後端 → Cloudflare Workers
   - 前端 → Cloudflare Pages

### Pull Request 注意事項

- PR 到 `main` 分支會自動執行測試
- **測試必須通過才能合併**
- 合併後會自動觸發部署

### 查看 CI/CD 狀態

前往 [GitHub Actions 頁面](https://github.com/bowen12274Bot/Logistics_tracking_system/actions) 查看執行狀態。

### 詳細設定說明

請參考 [CI/CD 設定指南](ci-cd-guide.md)（舊入口：`docs/ci-cd-guide.md`）。

---

## 📚 相關文件 (Related Documentation)

- [開發環境設定](getting-started.md)（舊入口：`docs/getting-started.md`）
- [測試指南](testing-guide.md)（舊入口：`docs/testing-guide.md`）
- [Docs 維護規範](docs-maintenance.md)
- [專案 README](../README.md)
