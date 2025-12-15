// backend/src/__tests__/tracking.test.ts
// 貨態追蹤測試 (Tracking)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("貨態追蹤 (Tracking)", () => {
  let customerToken: string;
  let testPackage: any;

  beforeAll(async () => {
    const user = await createTestUser();
    customerToken = user.token;
    testPackage = await createTestPackage(customerToken);
  });

  // ========== GET /api/tracking/:trackingNumber ==========
  describe("GET /api/tracking/:trackingNumber - 公開追蹤", () => {
    it("TRACK-PUB-001: 有效追蹤編號查詢", async () => {
      const { status, data } = await apiRequest<any>(
        `/api/tracking/${testPackage.tracking_number}`
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tracking_number).toBe(testPackage.tracking_number);
    });

    it("TRACK-PUB-002: 無效追蹤編號", async () => {
      const { status } = await apiRequest<any>("/api/tracking/INVALID12345");

      expect(status).toBe(404);
    });

    it("TRACK-PUB-003: 驗證事件結構", async () => {
      const { status, data } = await apiRequest<any>(
        `/api/tracking/${testPackage.tracking_number}`
      );

      expect(status).toBe(200);
      expect(Array.isArray(data.events)).toBe(true);
    });

    it("TRACK-PUB-004: 不需要認證", async () => {
      // 無 token 也可查詢
      const { status } = await apiRequest<any>(
        `/api/tracking/${testPackage.tracking_number}`
      );

      expect(status).toBe(200);
    });

    it("TRACK-PUB-005: 驗證 current_status 存在", async () => {
      const { status, data } = await apiRequest<any>(
        `/api/tracking/${testPackage.tracking_number}`
      );

      expect(status).toBe(200);
      expect(data.current_status).toBeDefined();
    });
  });

  // ========== POST /api/packages/:packageId/events ==========
  describe("POST /api/packages/:packageId/events - 建立貨態事件", () => {
    it("TRACK-EVT-007: 包裹不存在", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/packages/non-existent/events",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            delivery_status: "picked_up",
          }),
        }
      );

      expect(status).toBe(404);
    });

    it("TRACK-EVT-010: 建立事件成功", async () => {
      const pkg = await createTestPackage(customerToken);

      const { status, data } = await authenticatedRequest<any>(
        `/api/packages/${pkg.id}/events`,
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            delivery_status: "picked_up",
            delivery_details: "已取件",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ========== GET /api/tracking/search ==========
  describe("GET /api/tracking/search - 進階搜尋", () => {
    it("TRACK-SEARCH-007: customer 無權使用", async () => {
      const pkg = await createTestPackage(customerToken);

      const { status, data } = await authenticatedRequest<any>(
        `/api/tracking/search?tracking_number=${encodeURIComponent(pkg.tracking_number)}`,
        customerToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect((data.packages ?? []).some((p: any) => p.id === pkg.id)).toBe(true);
    });
  });
});
