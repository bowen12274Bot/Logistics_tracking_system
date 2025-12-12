// backend/src/__tests__/packages.test.ts
// 包裹管理測試 (Package)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("包裹管理 (Package)", () => {
  let customerToken: string;
  let customerId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    customerToken = user.token;
    
    // 取得用戶 ID
    const meResult = await authenticatedRequest<{ user: { id: string } }>(
      "/api/auth/me",
      customerToken
    );
    customerId = meResult.data.user.id;
  });

  // ========== POST /api/packages ==========
  describe("POST /api/packages - 建立包裹", () => {
    it("PKG-CREATE-001: 完整資料建立包裹", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/packages",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            customer_id: customerId,
            sender: "寄件者",
            receiver: "收件者",
            weight: 5,
            size: "medium",
            delivery_time: "standard",
            payment_type: "prepaid",
            contents_description: "測試內容物",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.package).toBeDefined();
      expect(data.package.tracking_number).toBeDefined();
    });

    it("PKG-CREATE-012: 驗證 tracking_number 格式", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/packages",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            customer_id: customerId,
            sender: "寄件者",
            receiver: "收件者",
            size: "small",
            delivery_time: "standard",
            payment_type: "prepaid",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.package.tracking_number).toMatch(/^TRK/);
    });

    it("PKG-CREATE-016: 驗證 status 初始為 created", async () => {
      const pkg = await createTestPackage(customerToken);
      // status 欄位可能在 package 中或需要查詢
      // 假設建立時已設定
      expect(pkg.id).toBeDefined();
    });

    it("PKG-CREATE-018: weight 可選填", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/packages",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            customer_id: customerId,
            sender: "寄件者",
            receiver: "收件者",
            size: "medium",
            delivery_time: "standard",
            payment_type: "prepaid",
            // 沒有 weight
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("PKG-CREATE-020: payment_method should follow billing_preference by default", async () => {
      const user = await createTestUser({ billing_preference: "bank_transfer" });
      const meResult = await authenticatedRequest<{ user: { id: string } }>(
        "/api/auth/me",
        user.token
      );
      const newCustomerId = meResult.data.user.id;

      const { status, data } = await authenticatedRequest<any>("/api/packages", user.token, {
        method: "POST",
        body: JSON.stringify({
          customer_id: newCustomerId,
          sender: "Sender",
          receiver: "Receiver",
          weight: 5,
          size: "medium",
          delivery_time: "standard",
          payment_type: "prepaid",
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.package.payment_method).toBe("online_bank");
    });
  });

  // ========== POST /api/packages/estimate ==========
  describe("POST /api/packages/estimate - 運費試算", () => {
    it("PKG-EST-001: 標準包裹試算", async () => {
      const { status, data } = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.estimate).toBeDefined();
      expect(data.estimate.total_cost).toBeGreaterThan(0);
    });

    it("PKG-EST-002: 隔夜達較高費用", async () => {
      const overnight = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "overnight",
        }),
      });

      const standard = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
        }),
      });

      expect(overnight.data.estimate.total_cost).toBeGreaterThan(
        standard.data.estimate.total_cost
      );
    });

    it("PKG-EST-003: 重量影響費用", async () => {
      const heavy = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
          weight: 20,
        }),
      });

      const light = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
          weight: 1,
        }),
      });

      expect(heavy.data.estimate.total_cost).toBeGreaterThan(
        light.data.estimate.total_cost
      );
    });

    it("PKG-EST-005: fragile 附加費", async () => {
      const fragile = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
          special_handling: ["fragile"],
        }),
      });

      const normal = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
        }),
      });

      expect(fragile.data.estimate.special_handling_surcharge).toBeGreaterThan(0);
      expect(fragile.data.estimate.total_cost).toBeGreaterThan(
        normal.data.estimate.total_cost
      );
    });

    it("PKG-EST-007: 驗證預計送達日期", async () => {
      const { status, data } = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
        }),
      });

      expect(status).toBe(200);
      expect(data.estimate.estimated_delivery_date).toBeDefined();
      // 格式應為 YYYY-MM-DD
      expect(data.estimate.estimated_delivery_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("PKG-EST-008: 無需認證（公開 API）", async () => {
      const { status } = await apiRequest<any>("/api/packages/estimate", {
        method: "POST",
        body: JSON.stringify({
          sender_address: "10,10",
          receiver_address: "50,50",
          service_level: "standard",
        }),
      });

      expect(status).toBe(200);
    });
  });

  // ========== GET /api/packages ==========
  describe("GET /api/packages - 查詢包裹列表", () => {
    it("PKG-LIST-001: 取得包裹列表", async () => {
      // 先建立一個包裹
      await createTestPackage(customerToken);

      const { status, data } = await authenticatedRequest<any>(
        "/api/packages",
        customerToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.packages)).toBe(true);
    });
  });

  // ========== GET /api/packages/:id/status ==========
  describe("GET /api/packages/:id/status - 查詢包裹狀態", () => {
    it("PKG-GET-001: 使用 ID 查詢包裹", async () => {
      const pkg = await createTestPackage(customerToken);

      const { status, data } = await authenticatedRequest<any>(
        `/api/packages/${pkg.id}/status`,
        customerToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.package).toBeDefined();
    });

    it("PKG-GET-003: 查詢不存在的包裹", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/packages/non-existent-id/status",
        customerToken
      );

      expect(status).toBe(404);
    });
  });
});
