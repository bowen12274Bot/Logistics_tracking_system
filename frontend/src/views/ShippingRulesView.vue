<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiPageShell from '../components/ui/UiPageShell.vue'
import UiCard from '../components/ui/UiCard.vue'

const { t } = useI18n()
</script>

<template>
  <UiPageShell eyebrow="運費說明" title="運費規則與計算方式" lede="完整的運費計算規則，包含路線成本、箱型判定、配送型態、重量加價與特殊標記。">
    
    <!-- 計算流程總覽 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">💡 計算流程總覽</h2>
        <p class="section-desc">運費計算採用多因素綜合定價，以下為完整的 14 步驟計算流程：</p>
      </div>

      <div class="flow-steps">
        <div class="flow-step">
          <span class="step-num">1-3</span>
          <span class="step-text">計算路線成本（routeCost）並標準化（÷5200，限制在 0.3~1.6）</span>
        </div>
        <div class="flow-step">
          <span class="step-num">4-6</span>
          <span class="step-text">計算材積重量、計費重量，判定箱型（信封/S/M/L）</span>
        </div>
        <div class="flow-step">
          <span class="step-num">7-8</span>
          <span class="step-text">計算基礎費用，套用配送型態係數（經濟 1.0 ~ 隔日 2.0）</span>
        </div>
        <div class="flow-step">
          <span class="step-num">9-10</span>
          <span class="step-text">計算重量加價（超過包含重量的部分）</span>
        </div>
        <div class="flow-step">
          <span class="step-num">11-13</span>
          <span class="step-text">套用特殊標記（國際件 ×1.8、危險物 +120、易碎 +60）</span>
        </div>
        <div class="flow-step">
          <span class="step-num">14</span>
          <span class="step-text">套用價格區間限制（floor / cap）得到最終價格</span>
        </div>
      </div>
    </UiCard>

    <!-- 路線成本 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">📍 路線成本（routeCost）</h2>
        <p class="section-desc">運費的核心變數，由起點到終點的最短路徑上所有道路成本加總而來。</p>
      </div>

      <div class="info-box">
        <p class="info-title">什麼是 routeCost？</p>
        <p class="info-text">routeCost 是地圖上最短路徑的總成本，綜合考慮了距離和路況（道路倍率）。</p>
        <p class="info-text">• 典型範圍：2,052 ~ 7,906</p>
        <p class="info-text">• 中位數（P50）：約 5,147</p>
      </div>

      <div class="info-box">
        <p class="info-title">標準化處理（Normalization）</p>
        <p class="info-formula">routeCostNorm = routeCost ÷ 5200</p>
        <p class="info-formula">然後限制在 0.30 ~ 1.60 之間（防止極端值）</p>
        <p class="info-note">💡 5200 是路線成本的中位數（P50），用於將成本標準化到合理範圍</p>
      </div>
    </UiCard>

    <!-- 箱型判定 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">📦 箱型判定</h2>
        <p class="section-desc">根據包裹尺寸和計費重量，自動判定適用的箱型。必須同時符合尺寸和重量限制。</p>
      </div>

      <div class="info-box">
        <p class="info-title">材積重量計算</p>
        <p class="info-formula">材積重量（kg）= 長(cm) × 寬(cm) × 高(cm) ÷ 6000</p>
        <p class="info-formula">計費重量 = max(實際重量, 材積重量)</p>
        <p class="info-note">📏 尺寸判定時會將三個維度由大到小排序（d1 ≥ d2 ≥ d3）</p>
      </div>

      <div class="table-wrapper">
        <table class="spec-table">
          <thead>
            <tr>
              <th>箱型</th>
              <th>尺寸上限</th>
              <th>計費重量上限</th>
              <th>包含重量</th>
              <th>超重加價</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>信封</strong></td>
              <td>最長邊 ≤ 30cm，厚度 ≤ 2cm</td>
              <td>≤ 0.5 kg</td>
              <td>0.5 kg</td>
              <td>無</td>
            </tr>
            <tr>
              <td><strong>小型箱 S</strong></td>
              <td>40 × 30 × 20 cm</td>
              <td>≤ 5 kg</td>
              <td>3 kg</td>
              <td>+18 元/kg</td>
            </tr>
            <tr>
              <td><strong>中型箱 M</strong></td>
              <td>60 × 40 × 40 cm</td>
              <td>≤ 20 kg</td>
              <td>10 kg</td>
              <td>+15 元/kg</td>
            </tr>
            <tr>
              <td><strong>大型箱 L</strong></td>
              <td>90 × 60 × 60 cm</td>
              <td>≤ 50 kg</td>
              <td>25 kg</td>
              <td>+12 元/kg</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="info-box warning">
        <p class="info-title">⚠️ 重量加價計算</p>
        <p class="info-formula">重量加價 = max(0, ⌈計費重量 - 包含重量⌉) × 每公斤費用</p>
        <p class="info-text">例如：中型箱，計費重量 12kg → 超重 2kg → 加價 2 × 15 = 30 元</p>
      </div>
    </UiCard>

    <!-- 基礎費用 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">💰 基礎費用計算</h2>
        <p class="section-desc">基礎費用由固定費用和路線成本係數組成。</p>
      </div>

      <div class="info-box">
        <p class="info-title">計算公式</p>
        <p class="info-formula">基礎費用 = baseFee + routeCostNorm × ratePerCost</p>
      </div>

      <div class="table-wrapper">
        <table class="price-table">
          <thead>
            <tr>
              <th>箱型</th>
              <th>baseFee（固定費用）</th>
              <th>ratePerCost（路線係數）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>信封</strong></td>
              <td>30 元</td>
              <td>90</td>
            </tr>
            <tr>
              <td><strong>小型箱 S</strong></td>
              <td>70 元</td>
              <td>170</td>
            </tr>
            <tr>
              <td><strong>中型箱 M</strong></td>
              <td>110 元</td>
              <td>260</td>
            </tr>
            <tr>
              <td><strong>大型箱 L</strong></td>
              <td>160 元</td>
              <td>380</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <!-- 配送型態 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">🚚 配送型態</h2>
        <p class="section-desc">不同的配送速度對應不同的價格係數。</p>
      </div>

      <div class="info-box">
        <p class="info-title">計算公式</p>
        <p class="info-formula">運費 = ⌈基礎費用 × 配送型態係數⌉</p>
        <p class="info-note">⌈ ⌉ 表示向上取整到整數</p>
      </div>

      <div class="delivery-grid">
        <div class="delivery-card">
          <div class="delivery-header">
            <h3>經濟 Economy</h3>
            <span class="delivery-multiplier">×1.00</span>
          </div>
          <p class="delivery-desc">最經濟的選擇，配送時間較長</p>
        </div>
        <div class="delivery-card">
          <div class="delivery-header">
            <h3>標準 Standard</h3>
            <span class="delivery-multiplier">×1.25</span>
          </div>
          <p class="delivery-desc">平衡價格與時效的選擇</p>
        </div>
        <div class="delivery-card">
          <div class="delivery-header">
            <h3>兩日 Two-Day</h3>
            <span class="delivery-multiplier">×1.55</span>
          </div>
          <p class="delivery-desc">兩個工作天內送達</p>
        </div>
        <div class="delivery-card">
          <div class="delivery-header">
            <h3>隔日 Overnight</h3>
            <span class="delivery-multiplier">×2.00</span>
          </div>
          <p class="delivery-desc">最快速度，隔日送達</p>
        </div>
      </div>
    </UiCard>

    <!-- 特殊標記 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">🏷️ 特殊標記費用</h2>
        <p class="section-desc">包裹的特殊需求會產生額外費用。可同時選擇多個標記。</p>
      </div>

      <div class="marks-grid">
        <div class="mark-card international">
          <div class="mark-header">
            <h3>國際件 International</h3>
            <span class="mark-fee">×1.8</span>
          </div>
          <p class="mark-desc">跨境運送，總費用加成 80%</p>
          <p class="mark-note">⚠️ 在所有費用（含重量加價）計算完成後才套用</p>
        </div>
        <div class="mark-card">
          <div class="mark-header">
            <h3>危險物 Dangerous</h3>
            <span class="mark-fee">+120 元</span>
          </div>
          <p class="mark-desc">需特殊處理的危險物品</p>
        </div>
        <div class="mark-card">
          <div class="mark-header">
            <h3>易碎 Fragile</h3>
            <span class="mark-fee">+60 元</span>
          </div>
          <p class="mark-desc">易碎物品，需額外包裝保護</p>
        </div>
      </div>

      <div class="info-box">
        <p class="info-title">計算順序</p>
        <p class="info-text">1. 先計算小計（運費 + 重量加價）</p>
        <p class="info-text">2. 若有國際件：小計 = ⌈小計 × 1.8⌉</p>
        <p class="info-text">3. 再加上危險物和易碎的固定費用</p>
      </div>
    </UiCard>

    <!-- 價格區間限制 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">📊 價格區間限制（Floor / Cap）</h2>
        <p class="section-desc">最終價格會限制在合理範圍內，避免極端情況。</p>
      </div>

      <div class="info-box">
        <p class="info-title">防呆機制</p>
        <p class="info-text">• <strong>最低價（Floor）</strong>：避免路線成本過低導致運費不合理</p>
        <p class="info-text">• <strong>最高價（Cap）</strong>：避免地圖異常或極端路徑導致價格爆炸</p>
        <p class="info-formula">最終價格 = min(max(計算價格, 最低價), 最高價)</p>
      </div>

      <div class="table-wrapper">
        <table class="range-table">
          <thead>
            <tr>
              <th rowspan="2">箱型</th>
              <th colspan="4">最低價（Floor）</th>
            </tr>
            <tr>
              <th>經濟</th>
              <th>標準</th>
              <th>兩日</th>
              <th>隔日</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>信封</strong></td>
              <td>50</td>
              <td>70</td>
              <td>90</td>
              <td>120</td>
            </tr>
            <tr>
              <td><strong>小型箱 S</strong></td>
              <td>120</td>
              <td>160</td>
              <td>210</td>
              <td>280</td>
            </tr>
            <tr>
              <td><strong>中型箱 M</strong></td>
              <td>200</td>
              <td>260</td>
              <td>340</td>
              <td>450</td>
            </tr>
            <tr>
              <td><strong>大型箱 L</strong></td>
              <td>320</td>
              <td>420</td>
              <td>550</td>
              <td>750</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="table-wrapper">
        <table class="range-table">
          <thead>
            <tr>
              <th rowspan="2">箱型</th>
              <th colspan="4">最高價（Cap）</th>
            </tr>
            <tr>
              <th>經濟</th>
              <th>標準</th>
              <th>兩日</th>
              <th>隔日</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>信封</strong></td>
              <td>400</td>
              <td>550</td>
              <td>700</td>
              <td>950</td>
            </tr>
            <tr>
              <td><strong>小型箱 S</strong></td>
              <td>900</td>
              <td>1,200</td>
              <td>1,500</td>
              <td>1,900</td>
            </tr>
            <tr>
              <td><strong>中型箱 M</strong></td>
              <td>1,400</td>
              <td>1,850</td>
              <td>2,350</td>
              <td>2,900</td>
            </tr>
            <tr>
              <td><strong>大型箱 L</strong></td>
              <td>2,200</td>
              <td>2,900</td>
              <td>3,700</td>
              <td>4,600</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>

    <!-- 完整計算範例 -->
    <UiCard>
      <div class="section-header">
        <h2 class="section-title">🧮 完整計算範例</h2>
        <p class="section-desc">以實際案例說明完整的計算流程。</p>
      </div>

      <div class="example-box">
        <p class="example-title">範例條件</p>
        <p class="example-text">• 路線成本：5,147（約 P50 中位數）</p>
        <p class="example-text">• 尺寸：60 × 40 × 40 cm</p>
        <p class="example-text">• 實際重量：12 kg</p>
        <p class="example-text">• 配送型態：標準（×1.25）</p>
        <p class="example-text">• 特殊標記：國際件、易碎</p>
      </div>

      <div class="calculation-steps">
        <div class="calc-step">
          <span class="calc-label">1. 路線成本標準化</span>
          <span class="calc-value">5,147 ÷ 5,200 ≈ 0.99</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">2. 材積重量</span>
          <span class="calc-value">60×40×40 ÷ 6,000 ≈ 16 kg</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">3. 計費重量</span>
          <span class="calc-value">max(12, 16) = 16 kg</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">4. 箱型判定</span>
          <span class="calc-value">中型箱 M（符合尺寸和重量限制）</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">5. 基礎費用</span>
          <span class="calc-value">110 + 0.99×260 ≈ 367.4 元</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">6. 套用配送型態</span>
          <span class="calc-value">⌈367.4 × 1.25⌉ = 460 元</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">7. 重量加價</span>
          <span class="calc-value">⌈16 - 10⌉ × 15 = 90 元</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">8. 小計</span>
          <span class="calc-value">460 + 90 = 550 元</span>
        </div>
        <div class="calc-step highlight">
          <span class="calc-label">9. 國際件加成</span>
          <span class="calc-value">⌈550 × 1.8⌉ = 990 元</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">10. 易碎標記</span>
          <span class="calc-value">990 + 60 = 1,050 元</span>
        </div>
        <div class="calc-step">
          <span class="calc-label">11. 套用價格區間</span>
          <span class="calc-value">min(max(1,050, 260), 1,850) = 1,050 元</span>
        </div>
        <div class="calc-step final">
          <span class="calc-label">最終價格</span>
          <span class="calc-value">1,050 元</span>
        </div>
      </div>
    </UiCard>

  </UiPageShell>
</template>

<style scoped>
/* Card spacing */
:deep(.page-shell) > * + * {
  margin-top: 24px;
}

/* Section header */
.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: rgba(107, 74, 64, 0.95);
  margin: 0 0 8px 0;
}

.section-desc {
  color: rgba(107, 74, 64, 0.7);
  line-height: 1.6;
  margin: 0;
  font-size: 14px;
}

/* Flow steps */
.flow-steps {
  display: grid;
  gap: 12px;
  margin: 16px 0;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-left: 4px solid rgba(244, 182, 194, 0.6);
  border-radius: 8px;
}

.step-num {
  flex-shrink: 0;
  font-weight: 700;
  font-size: 14px;
  color: rgba(165, 122, 99, 0.9);
  background: rgba(244, 182, 194, 0.2);
  padding: 4px 10px;
  border-radius: 6px;
}

.step-text {
  font-size: 14px;
  color: rgba(107, 74, 64, 0.85);
  line-height: 1.5;
}

/* Info boxes */
.info-box {
  margin-top: 16px;
  padding: 16px 18px;
  background: rgba(255, 248, 241, 0.8);
  border-left: 4px solid rgba(244, 182, 194, 0.6);
  border-radius: 8px;
}

.info-box.warning {
  background: rgba(255, 243, 224, 0.8);
  border-left-color: rgba(255, 164, 164, 0.6);
}

.info-title {
  font-weight: 700;
  color: rgba(107, 74, 64, 0.9);
  margin: 0 0 10px 0;
  font-size: 15px;
}

.info-text {
  margin: 6px 0;
  color: rgba(107, 74, 64, 0.8);
  font-size: 14px;
  line-height: 1.6;
}

.info-formula {
  margin: 8px 0;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: rgba(107, 74, 64, 0.9);
  font-weight: 600;
}

.info-note {
  margin: 10px 0 0 0;
  padding: 8px 12px;
  background: rgba(244, 182, 194, 0.15);
  border-radius: 6px;
  font-size: 13px;
  color: rgba(107, 74, 64, 0.8);
  line-height: 1.5;
}

/* Tables */
.table-wrapper {
  overflow-x: auto;
  margin: 16px 0;
}

.spec-table,
.price-table,
.range-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.spec-table th,
.price-table th,
.range-table th {
  background: rgba(244, 182, 194, 0.15);
  padding: 12px 14px;
  text-align: left;
  font-weight: 700;
  color: rgba(107, 74, 64, 0.9);
  border-bottom: 2px solid rgba(165, 122, 99, 0.2);
}

.spec-table td,
.price-table td,
.range-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(165, 122, 99, 0.1);
  color: rgba(107, 74, 64, 0.85);
}

.spec-table tbody tr:hover,
.price-table tbody tr:hover,
.range-table tbody tr:hover {
  background: rgba(244, 182, 194, 0.05);
}

/* Delivery grid */
.delivery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.delivery-card {
  padding: 18px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(165, 122, 99, 0.2);
  transition: all 0.2s ease;
}

.delivery-card:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(244, 182, 194, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(170, 124, 105, 0.12);
}

.delivery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.delivery-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: rgba(107, 74, 64, 0.95);
}

.delivery-multiplier {
  font-size: 14px;
  font-weight: 700;
  color: rgba(165, 122, 99, 0.8);
  padding: 4px 10px;
  background: rgba(244, 182, 194, 0.2);
  border-radius: 6px;
}

.delivery-desc {
  margin: 0;
  font-size: 13px;
  color: rgba(107, 74, 64, 0.7);
  line-height: 1.5;
}

/* Marks grid */
.marks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin: 16px 0;
}

.mark-card {
  padding: 18px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(165, 122, 99, 0.2);
  transition: all 0.2s ease;
}

.mark-card.international {
  background: rgba(255, 248, 241, 0.8);
  border-color: rgba(244, 182, 194, 0.4);
}

.mark-card:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(244, 182, 194, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(170, 124, 105, 0.12);
}

.mark-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.mark-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: rgba(107, 74, 64, 0.95);
}

.mark-fee {
  font-size: 14px;
  font-weight: 700;
  color: rgba(165, 122, 99, 0.8);
  padding: 4px 10px;
  background: rgba(244, 182, 194, 0.2);
  border-radius: 6px;
}

.mark-desc {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: rgba(107, 74, 64, 0.7);
  line-height: 1.5;
}

.mark-note {
  margin: 0;
  padding: 6px 10px;
  background: rgba(255, 243, 224, 0.6);
  border-left: 3px solid rgba(255, 164, 164, 0.5);
  border-radius: 4px;
  font-size: 12px;
  color: rgba(107, 74, 64, 0.8);
}

/* Example box */
.example-box {
  padding: 16px 18px;
  background: rgba(244, 182, 194, 0.1);
  border-radius: 8px;
  margin-bottom: 16px;
}

.example-title {
  font-weight: 700;
  color: rgba(107, 74, 64, 0.9);
  margin: 0 0 10px 0;
  font-size: 15px;
}

.example-text {
  margin: 4px 0;
  color: rgba(107, 74, 64, 0.8);
  font-size: 14px;
}

/* Calculation steps */
.calculation-steps {
  display: grid;
  gap: 8px;
}

.calc-step {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 8px;
  border-left: 3px solid rgba(165, 122, 99, 0.2);
}

.calc-step.highlight {
  background: rgba(255, 248, 241, 0.8);
  border-left-color: rgba(244, 182, 194, 0.6);
}

.calc-step.final {
  background: rgba(244, 182, 194, 0.2);
  border-left-color: rgba(165, 122, 99, 0.6);
  font-weight: 700;
}

.calc-label {
  font-size: 14px;
  color: rgba(107, 74, 64, 0.85);
}

.calc-value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(107, 74, 64, 0.95);
  font-family: 'Courier New', monospace;
}

@media (max-width: 768px) {
  .delivery-grid,
  .marks-grid {
    grid-template-columns: 1fr;
  }
  
  .table-wrapper {
    font-size: 13px;
  }
  
  .calc-step {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
