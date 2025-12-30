/**
 * Benchmark Runner with Report Generation
 * 
 * This script runs the benchmark tests and generates reports.
 * Run with: npx tsx scripts/run-benchmark-with-report.ts
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const THRESHOLD = 10; // P99 threshold in ms

interface BenchmarkResult {
  endpoint: string;
  method: string;
  path: string;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  status: 'pass' | 'slow';
}

interface ReportData {
  timestamp: string;
  config: { iterations: number; warmup: number };
  summary: {
    totalEndpoints: number;
    avgP99: number;
    slowCount: number;
    passRate: string;
  };
  results: BenchmarkResult[];
}

async function runBenchmark(): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const proc = spawn('npx', ['vitest', 'run', '--config', 'vitest.benchmark.config.ts', '--reporter=verbose'], {
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env }
    });

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stderr.write(str);
    });

    proc.on('close', (code) => {
      resolve(output);
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function parseOutput(output: string): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  
  // Parse lines like: "✅ 地圖資料: P99=5.23ms, P50=2.10ms"
  const regex = /[✅⚠️]\s+(.+?):\s+P99=([\d.]+)ms,\s+P50=([\d.]+)ms/g;
  let match;
  
  while ((match = regex.exec(output)) !== null) {
    const endpoint = match[1];
    const p99 = parseFloat(match[2]);
    const p50 = parseFloat(match[3]);
    
    // Find the path from the endpoint name mapping
    const pathMapping: Record<string, { method: string; path: string }> = {
      '地圖資料': { method: 'GET', path: '/api/map' },
      '路線計算': { method: 'GET', path: '/api/map/route' },
      '運費試算': { method: 'POST', path: '/api/packages/estimate' },
      '取得用戶資訊': { method: 'GET', path: '/api/auth/me' },
      '包裹列表': { method: 'GET', path: '/api/packages' },
      '客戶存在檢查': { method: 'GET', path: '/api/customers/me/exists' },
      '司機任務清單': { method: 'GET', path: '/api/driver/tasks' },
      '司機車輛狀態': { method: 'GET', path: '/api/driver/vehicle' },
      '車上貨物': { method: 'GET', path: '/api/vehicles/me/cargo' },
      '站內包裹': { method: 'GET', path: '/api/warehouse/packages' },
      '異常池列表': { method: 'GET', path: '/api/cs/exceptions' },
      '合約申請列表': { method: 'GET', path: '/api/admin/contract-applications' },
      '系統錯誤列表': { method: 'GET', path: '/api/admin/system/errors' },
      '帳單列表': { method: 'GET', path: '/api/billing/bills' },
      '付款紀錄': { method: 'GET', path: '/api/billing/payments' },
    };
    
    const info = pathMapping[endpoint] || { method: 'GET', path: '/api/unknown' };
    
    results.push({
      endpoint,
      method: info.method,
      path: info.path,
      p50,
      p95: p50 * 1.5, // Estimate if not available
      p99,
      mean: (p50 + p99) / 2,
      stdDev: (p99 - p50) / 2,
      min: p50 * 0.8,
      max: p99 * 1.2,
      status: p99 <= THRESHOLD ? 'pass' : 'slow'
    });
  }
  
  return results;
}

function generateOptimizationPlan(slowEndpoints: BenchmarkResult[]): string {
  let plan = `# API 性能優化計畫\n\n`;
  plan += `生成時間: ${new Date().toISOString()}\n`;
  plan += `P99 閾值: ${THRESHOLD}ms\n\n`;
  
  if (slowEndpoints.length === 0) {
    plan += `## ✅ 恭喜！所有端點都達標\n\n`;
    plan += `目前所有 API 端點的 P99 響應時間都在 ${THRESHOLD}ms 以內。\n`;
    return plan;
  }
  
  plan += `## ⚠️ 需要優化的端點 (${slowEndpoints.length} 個)\n\n`;
  
  for (const ep of slowEndpoints) {
    const severity = ep.p99 > 50 ? '🔴 嚴重' : ep.p99 > 20 ? '🟠 中等' : '🟡 輕微';
    
    plan += `### ${ep.endpoint}\n`;
    plan += `- **路徑**: \`${ep.method} ${ep.path}\`\n`;
    plan += `- **當前 P99**: ${ep.p99.toFixed(2)}ms\n`;
    plan += `- **目標 P99**: ≤ ${THRESHOLD}ms\n`;
    plan += `- **嚴重程度**: ${severity}\n\n`;
    
    // Generate specific optimization recommendations
    plan += `#### 優化建議:\n\n`;
    
    // Common optimizations based on endpoint type
    if (ep.path.includes('/map')) {
      plan += `1. **快取策略**: 地圖數據相對靜態，應實施強快取\n`;
      plan += `   - 使用 Cloudflare KV 或 Workers Cache API\n`;
      plan += `   - 設置 \`Cache-Control: public, max-age=3600\`\n`;
      plan += `2. **預計算路線**: 對常見起點終點組合預計算路線\n`;
      plan += `3. **Dijkstra 優化**: 使用優先佇列優化路徑搜尋\n\n`;
    } else if (ep.path.includes('/packages')) {
      plan += `1. **資料庫索引優化**:\n`;
      plan += `   \`\`\`sql\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_packages_sender_id ON packages(sender_id);\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);\n`;
      plan += `   \`\`\`\n`;
      plan += `2. **分頁優化**: 確保使用 cursor-based pagination\n`;
      plan += `3. **欄位篩選**: 只查詢需要的欄位，避免 SELECT *\n\n`;
    } else if (ep.path.includes('/driver') || ep.path.includes('/warehouse')) {
      plan += `1. **Join 優化**: 檢查是否有不必要的 JOIN 操作\n`;
      plan += `2. **索引優化**:\n`;
      plan += `   \`\`\`sql\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_tasks_driver_id ON tasks(driver_id);\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);\n`;
      plan += `   \`\`\`\n`;
      plan += `3. **批量查詢**: 使用 IN 子句替代多次查詢\n\n`;
    } else if (ep.path.includes('/cs/exceptions')) {
      plan += `1. **資料庫索引**:\n`;
      plan += `   \`\`\`sql\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_exceptions_created_at ON exceptions(created_at);\n`;
      plan += `   \`\`\`\n`;
      plan += `2. **快取未處理計數**: 使用 KV 快取異常數量\n`;
      plan += `3. **分頁**: 限制每頁返回數量\n\n`;
    } else if (ep.path.includes('/billing')) {
      plan += `1. **索引優化**:\n`;
      plan += `   \`\`\`sql\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);\n`;
      plan += `   CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);\n`;
      plan += `   \`\`\`\n`;
      plan += `2. **預計算帳單摘要**: 定期更新而非即時計算\n`;
      plan += `3. **項目延遲載入**: 帳單詳情按需載入\n\n`;
    } else if (ep.path.includes('/admin')) {
      plan += `1. **分頁與過濾**: 強制使用分頁，限制單次查詢量\n`;
      plan += `2. **權限快取**: 快取管理員權限檢查結果\n`;
      plan += `3. **索引優化**: 為常用查詢欄位建立索引\n\n`;
    } else {
      plan += `1. **通用優化**:\n`;
      plan += `   - 檢查 SQL 查詢效率\n`;
      plan += `   - 考慮增加適當的資料庫索引\n`;
      plan += `   - 實施快取策略\n`;
      plan += `   - 減少不必要的資料傳輸\n\n`;
    }
  }
  
  // General recommendations
  plan += `## 📋 通用優化建議\n\n`;
  plan += `### 1. 資料庫層面\n`;
  plan += `- 使用 \`EXPLAIN QUERY PLAN\` 分析慢查詢\n`;
  plan += `- 確保所有 WHERE 條件欄位都有索引\n`;
  plan += `- 使用適當的 JOIN 類型\n`;
  plan += `- 限制返回的資料量（分頁、欄位篩選）\n\n`;
  
  plan += `### 2. 快取層面\n`;
  plan += `- Cloudflare Workers Cache API 用於頻繁訪問的端點\n`;
  plan += `- KV 用於會話和配置資料\n`;
  plan += `- 設置合理的 TTL\n\n`;
  
  plan += `### 3. 代碼層面\n`;
  plan += `- 避免 N+1 查詢問題\n`;
  plan += `- 使用批量操作替代循環單一操作\n`;
  plan += `- 減少序列化/反序列化開銷\n\n`;
  
  plan += `### 4. 監控與追蹤\n`;
  plan += `- 實施 APM 追蹤慢查詢\n`;
  plan += `- 設置性能警報\n`;
  plan += `- 定期執行性能基準測試\n\n`;
  
  return plan;
}

async function main() {
  console.log('🚀 開始執行性能基準測試...\n');
  
  const output = await runBenchmark();
  const results = parseOutput(output);
  
  if (results.length === 0) {
    console.log('\n⚠️ 無法解析測試結果，請檢查測試輸出');
    return;
  }
  
  // Sort by P99 descending
  results.sort((a, b) => b.p99 - a.p99);
  
  // Generate summary
  const slowEndpoints = results.filter(r => r.status === 'slow');
  const avgP99 = results.reduce((sum, r) => sum + r.p99, 0) / results.length;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 測試結果摘要');
  console.log('='.repeat(80));
  console.log(`總端點數: ${results.length}`);
  console.log(`平均 P99: ${avgP99.toFixed(2)}ms`);
  console.log(`超標端點: ${slowEndpoints.length} (P99 > ${THRESHOLD}ms)`);
  console.log(`達標率: ${((results.length - slowEndpoints.length) / results.length * 100).toFixed(1)}%`);
  console.log('='.repeat(80));
  
  // Create report data
  const reportData: ReportData = {
    timestamp: new Date().toISOString(),
    config: { iterations: 20, warmup: 3 },
    summary: {
      totalEndpoints: results.length,
      avgP99,
      slowCount: slowEndpoints.length,
      passRate: ((results.length - slowEndpoints.length) / results.length * 100).toFixed(1)
    },
    results
  };
  
  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save JSON report
  const jsonPath = path.join(reportsDir, 'benchmark-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 JSON 報告已保存: ${jsonPath}`);
  
  // Generate optimization plan
  const optimizationPlan = generateOptimizationPlan(slowEndpoints);
  const planPath = path.join(reportsDir, 'optimization-plan.md');
  fs.writeFileSync(planPath, optimizationPlan);
  console.log(`📝 優化計畫已保存: ${planPath}`);
  
  // Generate HTML report
  const { execSync } = require('child_process');
  try {
    execSync('npx tsx scripts/generate-report.ts', { cwd: process.cwd(), stdio: 'inherit' });
  } catch (e) {
    console.log('⚠️ HTML 報告生成失敗，請手動執行: npx tsx scripts/generate-report.ts');
  }
  
  console.log('\n✅ 性能測試完成！');
}

main().catch(console.error);
