/**
 * ShippingEstimateView Tests
 * 
 * ⚠️ 此元件目前為最小化實作 (僅 595 bytes)
 * 功能尚未完整開發，所有測試標記為 skip
 */

import { describe, it } from 'vitest'

describe.skip('ShippingEstimateView', () => {
  describe('地址輸入', () => {
    it.todo('應該有寄件地址輸入欄位')
    it.todo('應該有收件地址輸入欄位')
    it.todo('應該支援地址搜尋/選擇')
  })

  describe('包裹資訊輸入', () => {
    it.todo('應該有重量輸入欄位')
    it.todo('應該有尺寸輸入欄位 (長/寬/高)')
    it.todo('應該有配送時效選項')
    it.todo('應該有特殊處理選項 (易碎/危險品/國際)')
  })

  describe('運費試算', () => {
    it.todo('應該在輸入完成後顯示試算按鈕')
    it.todo('應該呼叫 estimatePackage API')
    it.todo('應該顯示費用明細 (基本費/距離費/加價)')
    it.todo('應該顯示預計送達日期')
    it.todo('應該顯示總費用')
  })

  describe('導航到寄件', () => {
    it.todo('應該有「立即寄件」按鈕')
    it.todo('點擊應導航到寄件頁並帶入試算資料')
  })
})
