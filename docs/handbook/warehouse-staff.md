# 倉儲員（warehouse_staff）作業手冊

本文件描述倉儲端的 UI/操作步驟與驗收點；規則與一致性約束以 `docs/modules/operations.md` 為準。

## 操作流程（從卸貨到轉運）

1. 司機卸貨到站：包裹到站後，倉儲端可在本站清單看到它。
2. 點收確認（Receive）：在站內清單勾選包裹，以 `package_id` 送出點收。
3. 分揀（Sorting）：點收後包裹進入分揀工作區（通常由系統自動進入）。
4. 決定下一跳（Next hop）：把包裹分到本站相鄰節點的群組（可由系統先做預設分組）。
5. 送出派發（Dispatch next）：送出後建立下一段任務，等待司機接手運送。

## UI 最小驗收（摘要）

- 倉儲員登入後，只能看到本站包裹（不跨站）。
- 倉儲員不能選擇或更改站點。
- 只能派發到相鄰節點（不可跨站派發）。

## Links

- 倉儲規則權威：`docs/modules/operations.md`
- 異常規則權威：`docs/modules/exceptions.md`
