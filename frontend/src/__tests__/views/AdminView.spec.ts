/**
 * AdminView Tests
 * 
 * ⚠️ 此元件目前僅為佔位頁面，尚未完整實作
 * 根據 ui-spec.md 規劃的功能尚未開發：
 * - 系統總覽 (System Dashboard)
 * - 使用者與權限管理
 * - 服務規則設定 (Service Rules)
 * 
 * 所有測試標記為 skip，待元件完整實作後啟用
 */

import { describe, it } from 'vitest'

describe.skip('AdminView', () => {
  describe('系統總覽 (System Dashboard)', () => {
    it.todo('應該顯示關鍵指標 (KPI)')
    it.todo('應該顯示今日單量')
    it.todo('應該顯示異常率')
    it.todo('應該顯示營收總額')
    it.todo('應該顯示最近 7 日單量趨勢圖表')
    it.todo('應該顯示即時警示 (Critical 等級)')
  })

  describe('使用者與權限管理', () => {
    it.todo('應該顯示員工列表')
    it.todo('應該支援搜尋員工')
    it.todo('應該能新增員工')
    it.todo('應該能編輯員工資料')
    it.todo('應該能設定員工角色 (Driver/Warehouse/CS/Admin)')
    it.todo('應該能設定員工工作地 (Hub/Station)')
    it.todo('應該能停用/啟用帳號')
    it.todo('應該能重設密碼')
  })

  describe('服務規則設定 (Service Rules)', () => {
    it.todo('應該顯示各 Box Type 與 Service Level 的基礎費率')
    it.todo('應該能編輯費率表')
    it.todo('應該能設定國際運送加價')
    it.todo('應該能設定易碎品加價')
  })
})
