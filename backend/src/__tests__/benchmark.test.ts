/**
 * API Performance Benchmark Tool
 * 
 * This test file measures the performance of all API endpoints.
 * It collects P50, P95, P99 latency metrics and generates a report.
 * 
 * Run with: npx vitest run src/__tests__/benchmark.test.ts --reporter=verbose
 */

import { describe, it, expect, beforeAll } from "vitest";
import { env, SELF } from "cloudflare:test";

// Types
interface EndpointConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  name: string;
  requiresAuth?: "customer" | "driver" | "warehouse_staff" | "customer_service" | "admin";
  body?: Record<string, unknown>;
  setup?: () => Promise<void>;
}

interface TimingResult {
  endpoint: string;
  method: string;
  path: string;
  times: number[];
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  stdDev: number;
}

// Configuration
const ITERATIONS = 20; // Number of requests per endpoint
const WARMUP_ITERATIONS = 3; // Warmup requests (not counted)

// Token storage
const tokens: Record<string, string> = {};

// Helper: Calculate percentile
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// Helper: Calculate standard deviation
function stdDev(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

// Helper: Get auth token
async function getToken(userClass: string): Promise<string> {
  if (tokens[userClass]) return tokens[userClass];

  const credentials: Record<string, { email: string; password: string }> = {
    customer: { email: "test_customer@example.com", password: "password123" },
    driver: { email: "test_driver@example.com", password: "password123" },
    warehouse_staff: { email: "test_warehouse@example.com", password: "password123" },
    customer_service: { email: "test_cs@example.com", password: "password123" },
    admin: { email: "test_admin@example.com", password: "password123" },
  };

  const cred = credentials[userClass];
  if (!cred) throw new Error(`Unknown user class: ${userClass}`);

  const res = await SELF.fetch("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: cred.email, password: cred.password }),
  });

  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error(`Failed to get token for ${userClass}`);

  tokens[userClass] = data.token;
  return data.token;
}

// Helper: Measure single request
async function measureRequest(config: EndpointConfig): Promise<number> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.requiresAuth) {
    const token = await getToken(config.requiresAuth);
    headers["Authorization"] = `Bearer ${token}`;
  }

  const start = performance.now();
  
  await SELF.fetch(`http://localhost${config.path}`, {
    method: config.method,
    headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
  });

  const end = performance.now();
  return end - start;
}

// Endpoint configurations
const endpoints: EndpointConfig[] = [
  // Public endpoints
  { method: "GET", path: "/api/map", name: "地圖資料" },
  { method: "GET", path: "/api/map/route?from=HUB_0&to=END_HOME_1", name: "路線計算" },
  { method: "POST", path: "/api/packages/estimate", name: "運費試算", body: {
    sender_address: "END_HOME_1",
    receiver_address: "END_HOME_2",
    weight: 2,
    dimensions: { length: 30, width: 20, height: 10 },
    service_level: "standard"
  }},

  // Auth endpoints
  { method: "GET", path: "/api/auth/me", name: "取得用戶資訊", requiresAuth: "customer" },

  // Customer endpoints
  { method: "GET", path: "/api/packages", name: "包裹列表", requiresAuth: "customer" },
  { method: "GET", path: "/api/customers/me/exists", name: "客戶存在檢查", requiresAuth: "customer" },

  // Driver endpoints
  { method: "GET", path: "/api/driver/tasks", name: "司機任務清單", requiresAuth: "driver" },
  { method: "GET", path: "/api/driver/vehicle", name: "司機車輛狀態", requiresAuth: "driver" },
  { method: "GET", path: "/api/driver/vehicle/cargo", name: "車上貨物", requiresAuth: "driver" },

  // Warehouse endpoints
  { method: "GET", path: "/api/warehouse/packages", name: "站內包裹", requiresAuth: "warehouse_staff" },

  // Customer Service endpoints
  { method: "GET", path: "/api/cs/exceptions", name: "異常池列表", requiresAuth: "customer_service" },

  // Admin endpoints
  { method: "GET", path: "/api/admin/contract-applications", name: "合約申請列表", requiresAuth: "admin" },
  { method: "GET", path: "/api/admin/system/errors", name: "系統錯誤列表", requiresAuth: "admin" },

  // Billing endpoints
  { method: "GET", path: "/api/billing/bills", name: "帳單列表", requiresAuth: "customer" },
  { method: "GET", path: "/api/billing/payments", name: "付款紀錄", requiresAuth: "customer" },
];

// Results storage
const results: TimingResult[] = [];

describe("API Performance Benchmark", () => {
  beforeAll(async () => {
    // Ensure test users exist - login attempts will verify this
    console.log("\n📊 Starting API Performance Benchmark");
    console.log(`   Iterations: ${ITERATIONS} per endpoint`);
    console.log(`   Warmup: ${WARMUP_ITERATIONS} requests\n`);
  });

  for (const endpoint of endpoints) {
    it(`[PERF] ${endpoint.method} ${endpoint.path}`, async () => {
      const times: number[] = [];

      // Warmup
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        try {
          await measureRequest(endpoint);
        } catch (e) {
          // Ignore warmup errors
        }
      }

      // Actual measurements
      for (let i = 0; i < ITERATIONS; i++) {
        try {
          const time = await measureRequest(endpoint);
          times.push(time);
        } catch (e) {
          console.error(`Error measuring ${endpoint.name}:`, e);
        }
      }

      if (times.length === 0) {
        console.warn(`⚠️ No successful measurements for ${endpoint.name}`);
        return;
      }

      const result: TimingResult = {
        endpoint: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
        times,
        mean: times.reduce((a, b) => a + b, 0) / times.length,
        p50: percentile(times, 50),
        p95: percentile(times, 95),
        p99: percentile(times, 99),
        min: Math.min(...times),
        max: Math.max(...times),
        stdDev: stdDev(times),
      };

      results.push(result);

      // Console output
      const status = result.p99 <= 10 ? "✅" : "⚠️";
      console.log(`${status} ${endpoint.name}: P99=${result.p99.toFixed(2)}ms, P50=${result.p50.toFixed(2)}ms`);

      // Assert P99 is reasonable (soft check, won't fail test)
      expect(result.p99).toBeGreaterThan(0);
    }, 30000); // 30s timeout per endpoint
  }

  it("[REPORT] Generate Performance Report", async () => {
    if (results.length === 0) {
      console.warn("No benchmark results to report");
      return;
    }

    // Sort by P99 descending
    const sorted = [...results].sort((a, b) => b.p99 - a.p99);

    console.log("\n" + "=".repeat(80));
    console.log("📊 PERFORMANCE BENCHMARK REPORT");
    console.log("=".repeat(80));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Endpoints tested: ${results.length}`);
    console.log(`Iterations per endpoint: ${ITERATIONS}`);
    console.log("=".repeat(80));

    // Summary stats
    const allP99 = results.map(r => r.p99);
    const avgP99 = allP99.reduce((a, b) => a + b, 0) / allP99.length;
    const slowEndpoints = results.filter(r => r.p99 > 10);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Average P99: ${avgP99.toFixed(2)}ms`);
    console.log(`   Endpoints with P99 > 10ms: ${slowEndpoints.length}/${results.length}`);

    // Detailed table
    console.log(`\n📋 DETAILED RESULTS (sorted by P99 desc):`);
    console.log("-".repeat(100));
    console.log(
      "Endpoint".padEnd(25) +
      "Method".padEnd(8) +
      "P50(ms)".padEnd(12) +
      "P95(ms)".padEnd(12) +
      "P99(ms)".padEnd(12) +
      "Mean(ms)".padEnd(12) +
      "StdDev".padEnd(10) +
      "Status"
    );
    console.log("-".repeat(100));

    for (const r of sorted) {
      const status = r.p99 <= 10 ? "✅ OK" : "⚠️ SLOW";
      console.log(
        r.endpoint.substring(0, 24).padEnd(25) +
        r.method.padEnd(8) +
        r.p50.toFixed(2).padEnd(12) +
        r.p95.toFixed(2).padEnd(12) +
        r.p99.toFixed(2).padEnd(12) +
        r.mean.toFixed(2).padEnd(12) +
        r.stdDev.toFixed(2).padEnd(10) +
        status
      );
    }

    console.log("-".repeat(100));

    // Slow endpoint recommendations
    if (slowEndpoints.length > 0) {
      console.log(`\n⚠️ OPTIMIZATION RECOMMENDATIONS:`);
      for (const ep of slowEndpoints) {
        console.log(`   - ${ep.endpoint} (${ep.method} ${ep.path}): P99=${ep.p99.toFixed(2)}ms`);
      }
    }

    console.log("\n" + "=".repeat(80));

    // Generate JSON report for HTML visualization
    const reportData = {
      timestamp: new Date().toISOString(),
      config: { iterations: ITERATIONS, warmup: WARMUP_ITERATIONS },
      summary: {
        totalEndpoints: results.length,
        avgP99: avgP99,
        slowCount: slowEndpoints.length,
        passRate: ((results.length - slowEndpoints.length) / results.length * 100).toFixed(1),
      },
      results: sorted.map(r => ({
        endpoint: r.endpoint,
        method: r.method,
        path: r.path,
        p50: parseFloat(r.p50.toFixed(2)),
        p95: parseFloat(r.p95.toFixed(2)),
        p99: parseFloat(r.p99.toFixed(2)),
        mean: parseFloat(r.mean.toFixed(2)),
        stdDev: parseFloat(r.stdDev.toFixed(2)),
        min: parseFloat(r.min.toFixed(2)),
        max: parseFloat(r.max.toFixed(2)),
        status: r.p99 <= 10 ? "pass" : "slow",
      })),
    };

    // Store results for HTML report generation (global variable for post-processing)
    (globalThis as any).__benchmarkResults = reportData;

    expect(results.length).toBeGreaterThan(0);
  });
});
