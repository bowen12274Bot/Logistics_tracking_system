# 倉儲員（warehouse_staff）作業手冊

本文件描述倉儲端的 UI/操作步驟與驗收點；規則與一致性約束以 `docs/modules/operations.md` 為準。

## 操作流程（從卸貨到轉運）

1. 司機卸貨到站：包裹到站後，倉儲端可在本站清單看到它。
2. 點收確認（Receive）：在站內清單勾選包裹，以 `package_id` 送出點收。
3. 分揀（Sorting）：點收後包裹進入分揀工作區（通常由系統自動進入）。
4. 決定下一跳（Next hop）：把包裹分到本站相鄰節點的群組（可由系統先做預設分組）。
5. 送出派發（Dispatch next）：送出後建立下一段任務，等待司機接手運送。
6. 申報異常（Exception）：若包裹無法正常流轉（遺失、損毀、面單問題、錯分等），可在任一區（待點收/分揀/已派發）對該包裹申報異常。

## 異常申報（倉儲）

- 異常原因：`reason_code` 必選（下拉選單）
- 說明：`description` 必填（不論是否為「其他」）
- 位置：一律視為「異常點在配送站」（由後端以 `users.address` 寫入事件 `location`；前端不傳 location）
- 申報成功後：包裹會進入異常狀態並停止流轉，且所有進行中的任務段會被取消，從倉儲清單消失，等待客服處理/結案

## 異常申報紀錄

- 倉儲端提供「異常申報紀錄」列表：僅顯示自己提交的異常申報，並標示是否已由客服處理（handled）

## UI 最小驗收（摘要）

- 倉儲員登入後，只能看到本站包裹（不跨站）。
- 倉儲員不能選擇或更改站點。
- 只能派發到相鄰節點（不可跨站派發）。

## Links

- 倉儲規則權威：`docs/modules/operations.md`
- 異常規則權威：`docs/modules/exceptions.md`
- 功能文檔：`docs/features/warehouse-receive-and-sorting.md`、`docs/features/warehouse-dispatch-next-task.md`、`docs/features/exception-report-and-handle.md`
- API（接口參考）：`docs/reference/api/08-operations-tasks.md`、`docs/reference/api/07-exceptions.md`
