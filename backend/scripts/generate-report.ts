/**
 * Benchmark Report Generator
 * 
 * Generates an HTML visualization report from benchmark results.
 * This is a standalone Node.js script - run with: npx ts-node scripts/generate-report.ts
 */

// Use dynamic imports for Node.js modules
async function main() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  
  const threshold = 10; // P99 threshold in ms
  
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

  function generateHTML(data: ReportData): string {
    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API 效能基準測試報告</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e8e8e8;
      padding: 2rem;
    }
    
    .container { max-width: 1400px; margin: 0 auto; }
    
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(90deg, #00d4ff, #00ff88);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .subtitle { color: #888; margin-bottom: 2rem; }
    
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 1.5rem;
      border: 1px solid rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
    }
    
    .card-title { font-size: 0.9rem; color: #888; margin-bottom: 0.5rem; }
    .card-value { font-size: 2rem; font-weight: bold; }
    .card-value.good { color: #00ff88; }
    .card-value.warning { color: #ffaa00; }
    .card-value.bad { color: #ff4757; }
    
    .chart-container {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .chart-title { font-size: 1.2rem; margin-bottom: 1rem; color: #fff; }
    
    table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; }
    th, td { padding: 1rem; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { background: rgba(0,212,255,0.1); font-weight: 600; color: #00d4ff; }
    tr:hover { background: rgba(255,255,255,0.05); }
    
    .status-pass { background: rgba(0,255,136,0.2); color: #00ff88; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; }
    .status-slow { background: rgba(255,71,87,0.2); color: #ff4757; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; }
    
    .method { font-family: monospace; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
    .method-get { background: rgba(0,212,255,0.2); color: #00d4ff; }
    .method-post { background: rgba(0,255,136,0.2); color: #00ff88; }
    .method-put { background: rgba(255,170,0,0.2); color: #ffaa00; }
    .method-delete { background: rgba(255,71,87,0.2); color: #ff4757; }
    
    .footer { text-align: center; margin-top: 2rem; color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 API 效能基準測試報告</h1>
    <p class="subtitle">生成時間: ${data.timestamp} | 測試次數: ${data.config.iterations} 次/端點</p>
    
    <div class="cards">
      <div class="card">
        <div class="card-title">測試端點數</div>
        <div class="card-value">${data.summary.totalEndpoints}</div>
      </div>
      <div class="card">
        <div class="card-title">平均 P99</div>
        <div class="card-value ${data.summary.avgP99 <= threshold ? 'good' : 'warning'}">${data.summary.avgP99.toFixed(2)}ms</div>
      </div>
      <div class="card">
        <div class="card-title">超標端點</div>
        <div class="card-value ${data.summary.slowCount === 0 ? 'good' : 'bad'}">${data.summary.slowCount}</div>
      </div>
      <div class="card">
        <div class="card-title">達標率</div>
        <div class="card-value ${parseFloat(data.summary.passRate) >= 90 ? 'good' : 'warning'}">${data.summary.passRate}%</div>
      </div>
    </div>
    
    <div class="chart-container">
      <h3 class="chart-title">P99 延遲分布（閾值: ${threshold}ms）</h3>
      <canvas id="p99Chart" height="300"></canvas>
    </div>
    
    <div class="chart-container">
      <h3 class="chart-title">P50 / P95 / P99 比較</h3>
      <canvas id="percentileChart" height="300"></canvas>
    </div>
    
    <div class="chart-container">
      <h3 class="chart-title">詳細效能數據</h3>
      <table>
        <thead>
          <tr>
            <th>端點名稱</th>
            <th>Method</th>
            <th>P50 (ms)</th>
            <th>P95 (ms)</th>
            <th>P99 (ms)</th>
            <th>Mean (ms)</th>
            <th>StdDev</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          ${data.results.map(r => `
          <tr>
            <td><strong>${r.endpoint}</strong><br><small style="color:#666">${r.path}</small></td>
            <td><span class="method method-${r.method.toLowerCase()}">${r.method}</span></td>
            <td>${r.p50}</td>
            <td>${r.p95}</td>
            <td style="color: ${r.p99 <= threshold ? '#00ff88' : '#ff4757'}; font-weight: bold">${r.p99}</td>
            <td>${r.mean}</td>
            <td>${r.stdDev}</td>
            <td><span class="status-${r.status}">${r.status === 'pass' ? '✓ 達標' : '✗ 超標'}</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <p>Logistics Tracking System - API Performance Benchmark Report</p>
    </div>
  </div>
  
  <script>
    const data = ${JSON.stringify(data.results)};
    const threshold = ${threshold};
    
    new Chart(document.getElementById('p99Chart'), {
      type: 'bar',
      data: {
        labels: data.map(d => d.endpoint),
        datasets: [{
          label: 'P99 (ms)',
          data: data.map(d => d.p99),
          backgroundColor: data.map(d => d.p99 <= threshold ? 'rgba(0, 255, 136, 0.6)' : 'rgba(255, 71, 87, 0.6)'),
          borderColor: data.map(d => d.p99 <= threshold ? '#00ff88' : '#ff4757'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888' } },
          x: { grid: { display: false }, ticks: { color: '#888', maxRotation: 45 } }
        }
      }
    });
    
    new Chart(document.getElementById('percentileChart'), {
      type: 'bar',
      data: {
        labels: data.map(d => d.endpoint),
        datasets: [
          { label: 'P50', data: data.map(d => d.p50), backgroundColor: 'rgba(0, 212, 255, 0.6)', borderColor: '#00d4ff', borderWidth: 1 },
          { label: 'P95', data: data.map(d => d.p95), backgroundColor: 'rgba(255, 170, 0, 0.6)', borderColor: '#ffaa00', borderWidth: 1 },
          { label: 'P99', data: data.map(d => d.p99), backgroundColor: 'rgba(255, 71, 87, 0.6)', borderColor: '#ff4757', borderWidth: 1 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#888' } } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888' } },
          x: { grid: { display: false }, ticks: { color: '#888', maxRotation: 45 } }
        }
      }
    });
  </script>
</body>
</html>`;
  }

  // Resolve paths
  const scriptDir = process.cwd();
  const resultsPath = path.join(scriptDir, 'reports', 'benchmark-results.json');
  const outputPath = path.join(scriptDir, 'reports', 'benchmark-report.html');

  let data: ReportData;

  if (fs.existsSync(resultsPath)) {
    data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    console.log('📄 Found benchmark results, generating report...');
  } else {
    console.log('⚠️ No benchmark results found. Generating sample report for preview...');
    data = {
      timestamp: new Date().toISOString(),
      config: { iterations: 20, warmup: 3 },
      summary: { totalEndpoints: 8, avgP99: 8.5, slowCount: 2, passRate: "75.0" },
      results: [
        { endpoint: "地圖資料", method: "GET", path: "/api/map", p50: 2.1, p95: 4.5, p99: 6.2, mean: 2.8, stdDev: 1.2, min: 1.5, max: 8.1, status: "pass" },
        { endpoint: "路線計算", method: "GET", path: "/api/map/route", p50: 5.3, p95: 11.2, p99: 15.8, mean: 6.1, stdDev: 3.4, min: 3.2, max: 18.5, status: "slow" },
        { endpoint: "運費試算", method: "POST", path: "/api/packages/estimate", p50: 3.2, p95: 6.8, p99: 8.9, mean: 3.8, stdDev: 1.8, min: 2.1, max: 10.2, status: "pass" },
        { endpoint: "取得用戶資訊", method: "GET", path: "/api/auth/me", p50: 1.5, p95: 3.2, p99: 4.1, mean: 1.9, stdDev: 0.8, min: 1.1, max: 5.2, status: "pass" },
        { endpoint: "包裹列表", method: "GET", path: "/api/packages", p50: 4.8, p95: 9.5, p99: 12.3, mean: 5.2, stdDev: 2.5, min: 2.8, max: 14.1, status: "slow" },
        { endpoint: "司機任務清單", method: "GET", path: "/api/driver/tasks", p50: 3.1, p95: 5.8, p99: 7.2, mean: 3.5, stdDev: 1.5, min: 2.2, max: 8.5, status: "pass" },
        { endpoint: "站內包裹", method: "GET", path: "/api/warehouse/packages", p50: 2.8, p95: 5.5, p99: 7.8, mean: 3.2, stdDev: 1.6, min: 1.9, max: 9.1, status: "pass" },
        { endpoint: "異常池列表", method: "GET", path: "/api/cs/exceptions", p50: 2.2, p95: 4.8, p99: 6.5, mean: 2.6, stdDev: 1.3, min: 1.6, max: 7.8, status: "pass" },
      ]
    };
  }

  // Generate HTML
  const html = generateHTML(data);
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');
  
  console.log(`✅ Report generated: ${outputPath}`);
  console.log(`   Open in browser to view the visualization.`);
}

main().catch(console.error);
