# 系統序列圖 (Sequence Diagrams)

本文件補足 `todoList.md` 中 P4 (序列圖) 的需求，展示系統關鍵流程的互動時序。

## 1. 寄件與付款流程 (Prepaid)

描述客戶建立寄件單、試算運費並完成付款的流程。

```mermaid
sequenceDiagram
    actor Customer as 客戶
    participant Frontend as 前端 (Web)
    participant Backend as 後端 API
    participant DB as 資料庫

    Note over Customer, DB: 階段一：建立寄件與運費試算

    Customer->>Frontend: 填寫寄件/收件資訊
    Frontend->>Backend: POST /api/packages/estimate (運費試算)
    Backend-->>Frontend: 回傳預估運費 & 預計送達日
    Customer->>Frontend: 確認並提交訂單
    Frontend->>Backend: POST /api/packages (建立包裹)
    Backend->>DB: INSERT packages (status='created')
    DB-->>Backend: OK
    Backend-->>Frontend: 回傳 package_id & tracking_number

    Note over Customer, DB: 階段二：付款 (預付)

    Customer->>Frontend: 選擇付款方式 (e.g., Credit Card)
    Frontend->>Backend: POST /api/billing/payments
    Backend->>DB: INSERT payments (status='paid')
    Backend->>DB: UPDATE packages (payment_status='paid')
    DB-->>Backend: OK
    Backend-->>Frontend: 付款成功
    Frontend-->>Customer: 顯示寄件成功頁面 & 追蹤碼
```

## 2. 司機取件與配送流程

描述司機接單、前往取件、配送並更新狀的流程。

```mermaid
sequenceDiagram
    actor Driver as 司機
    participant App as 司機 App/Web
    participant Backend as 後端 API
    participant DB as 資料庫

    Note over Driver, DB: 階段一：每日任務獲取

    Driver->>App: 開啟工作清單頁面
    App->>Backend: GET /api/driver/tasks
    Backend->>DB: SELECT delivery_tasks WHERE driver_id = ...
    DB-->>Backend: Tasks List
    Backend-->>App: 回傳任務清單

    Note over Driver, DB: 階段二：執行取件 (Pickup)

    Driver->>App: 點擊「前往取件」
    App->>Backend: POST /api/driver/tasks/:id/status (in_progress)
    Driver->>App: 抵達並點擊「已取件」
    App->>Backend: POST /api/collections/confirm (或 update package status)
    Backend->>DB: UPDATE packages (status='picked_up')
    Backend->>DB: INSERT package_events (status='picked_up')
    Backend->>DB: UPDATE delivery_tasks (status='completed')
    DB-->>Backend: OK
    Backend-->>App: 更新成功

    Note over Driver, DB: 階段三：配送與簽收 (Delivery)

    Driver->>App: 點擊「前往配送」
    App->>Backend: POST /api/driver/tasks/:id/status (in_progress)
    Driver->>App: 抵達並執行「簽收/送達」
    App->>Backend: POST /api/driver/packages/:id/status (delivered)
    Backend->>DB: UPDATE packages (status='delivered')
    Backend->>DB: INSERT package_events (status='delivered')
    Backend->>DB: UPDATE delivery_tasks (status='completed')
    DB-->>Backend: OK
    Backend-->>App: 顯示配送完成
```

## 3. 貨態查詢流程 (公開)

描述一般使用者透過追蹤碼查詢貨態。

```mermaid
sequenceDiagram
    actor User as 使用者
    participant Frontend as 前端 (Web)
    participant Backend as 後端 API
    participant DB as 資料庫

    User->>Frontend: 輸入追蹤碼 (Tracking Number)
    Frontend->>Backend: GET /api/tracking/:trackingNumber
    Backend->>DB: SELECT packages JOIN package_events
    DB-->>Backend: Package Info & Events History
    Backend-->>Frontend: 回傳目前狀態與歷程
    Frontend-->>User: 顯示貨態時間軸與現在位置
```

## 4. 異常處理流程

描述配送異常的申報與客服處理流程。

```mermaid
sequenceDiagram
    actor Driver as 司機
    actor CS as 客服
    participant Backend as 後端 API
    participant DB as 資料庫

    Note over Driver, DB: 異常申報

    Driver->>Backend: POST /api/driver/packages/:id/exception
    Backend->>DB: INSERT package_exceptions
    Backend->>DB: UPDATE packages (status='exception')
    Backend->>DB: INSERT package_events (status='exception')
    Backend-->>Driver: 申報成功

    Note over CS, DB: 異常處理

    CS->>Backend: GET /api/cs/exceptions (查詢未處理異常)
    Backend->>DB: SELECT package_exceptions WHERE handled=0
    Backend-->>CS: 異常列表
    CS->>Backend: POST /api/cs/exceptions/:id/handle (處理異常)
    Backend->>DB: UPDATE package_exceptions (handled=1, report=...)
    Backend->>DB: INSERT package_events (status='exception_resolved')
    Backend-->>CS: 處理完成
```
