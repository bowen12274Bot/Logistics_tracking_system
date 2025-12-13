// backend/src/__tests__/billing.test.ts
// 計費帳單測試 (Billing)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
} from "./helpers";

describe("計費帳單 (Billing)", () => {
  let customerToken: string;

  beforeAll(async () => {
    const user = await createTestUser();
    customerToken = user.token;
  });

  // ========== GET /api/billing/bills ==========
  describe("GET /api/billing/bills - 帳單列表", () => {
    it("BILL-LIST-001: 客戶查詢自己的帳單", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/bills",
        customerToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.bills)).toBe(true);
    });

    it("BILL-LIST-002: 依 status 篩選", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/bills?status=pending",
        customerToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("BILL-LIST-005: 無 token", async () => {
      const { status } = await apiRequest<any>("/api/billing/bills");

      expect(status).toBe(401);
    });
  });

  // ========== GET /api/billing/bills/:billId ==========
  describe("GET /api/billing/bills/:billId - 帳單明細", () => {
    it("BILL-GET-002: 帳單不存在", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/billing/bills/non-existent-id",
        customerToken
      );

      expect(status).toBe(404);
    });
  });

  // ========== POST /api/billing/payments ==========
  describe("POST /api/billing/payments - 付款", () => {
    it("BILL-PAY-008: 無 token", async () => {
      const { status } = await apiRequest<any>("/api/billing/payments", {
        method: "POST",
        body: JSON.stringify({
          bill_id: "test",
          payment_method: "credit_card",
          amount: 1000,
        }),
      });

      expect(status).toBe(401);
    });
  });

  // ========== GET /api/billing/payments ==========
  describe("GET /api/billing/payments - 付款紀錄", () => {
    it("BILL-PAY-LIST-001: 查詢付款紀錄", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/payments",
        customerToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.payments)).toBe(true);
    });
  });
});
