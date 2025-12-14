
<script setup lang="ts">
import { RouterLink } from 'vue-router'

const highlights = [
  { title: '虛擬地圖', copy: '四環：中心、轉運站、門市、住家，車隊固定區域行駛。' },
  { title: '資料驅動計價', copy: '服務規則決定允許組合、費率與特殊處理費。' },
  { title: '生命週期追蹤', copy: '記錄取件、上/下車、分揀、配送、異常事件。' },
  { title: '帳務友善', copy: '支援預付、貨到付款，以及合約客戶的月結。' },
]

const roles = [
  { title: '客戶', to: '/customer', detail: '排程寄件、追蹤、付款、合約申請。' },
  { title: '司機', to: '/employee/driver', detail: '區內路線，紀錄事件與貨到付款。' },
  { title: '倉儲', to: '/employee/warehouse', detail: '配送站/配送中心掃描與分揀事件。' },
  { title: '管理員', to: '/admin', detail: '設定服務規則、價格、虛擬地圖。' },
]
</script>

<template>
  <section class="page-shell page-hero">
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="eyebrow">物流模擬系統</p>
        <h1>模擬建立寄件、轉運、配送</h1>
        <p class="lede">
          以虛擬地圖，模擬真實世界的貨物流動。
        </p>
        <div class="hero-actions">
          <RouterLink to="/map" class="primary-btn">虛擬地圖</RouterLink>
          <RouterLink to="/customer/track" class="ghost-btn">追蹤包裹</RouterLink>
          <RouterLink to="/shipping/estimate" class="ghost-btn">計算運費</RouterLink>
        </div>
      </div>

      <div class="card highlight-card">
        <p class="eyebrow">路徑</p>
        <ul class="task-list">
          <li>取件：住家/門市 -> 轉運站 -> 物流中心</li>
          <li>派送：物流中心 -> 轉運站 -> 住家/門市</li>
          <li>事件：取件、分揀、轉運、配送、異常</li>
          <li>帳務：抵達物流中心時更新月結週期</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="page-shell">
    <header class="section-header">
      <h2>運費算法</h2>
      <p class="hint">目前先提供面板佈局，後續會接上實際計價規則與 API。</p>
    </header>

    <div class="card">
      <div class="stack">
        <div>
          <p class="eyebrow">輸入</p>
          <p class="hint">尺寸（長寬高）、重量、配送時段、寄件/取件方式、付款方式。</p>
        </div>
        <div>
          <p class="eyebrow">規則</p>
          <p class="hint">基本費 + 距離/區域加成 + 重量/材積加成 + 時段加價 + 服務處理費。</p>
        </div>
        <div>
          <p class="eyebrow">輸出</p>
          <p class="hint">預估運費、拆解明細（各項加成）、以及不符合規則時的原因提示。</p>
        </div>
      </div>
    </div>
  </section>
</template>
