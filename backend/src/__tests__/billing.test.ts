// backend/src/__tests__/billing.test.ts
// 計費帳單測試 (Billing)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
  getAdminToken,
} from "./helpers";
import { describe401Tests } from "./authTestUtils";

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
  // ========== Monthly Billing Workflow Tests ==========
  describe("月結帳單完整流程測試", () => {
    let adminToken: string;
    let newUserId: string;
    let newUserToken: string;
    let applicationId: string;
    let billId: string;

    beforeAll(async () => {
      // Create Admin
      // createTestUser signature is (overrides: Record<string, any> = {})
      // But we probably want to use getAdminToken() or createEmployeeUser for admin?
      // Looking at helpers.ts, createTestUser is for customers.
      // Let's use getAdminToken() for simplicity if seed admin exists, or create one if needed.
      // But createEmployeeUser requires admin token.
      // Let's assume getAdminToken works (it relies on seeded admin).
      adminToken = await getAdminToken();

      // Create Customer (non-contract)
      const user = await createTestUser();
      newUserToken = user.token;
      // createTestUser returns { ...data, password, email }. data contains { user: publicUser(...) }
      // So structure is { user: { id... }, token: ..., password..., email... }
      newUserId = user.user.id;
    });

    it("BILL-FLOW-FULL: 月結帳單完整流程", async () => {
      // 1. Submit application
      const applyRes = await authenticatedRequest<any>(
        "/api/customers/contract-application",
        newUserToken,
        {
          method: "POST",
          body: JSON.stringify({
            company_name: "Test Corp",
            tax_id: "12345678",
            contact_person: "John Doe",
            contact_phone: "0912345678",
            billing_address: "Taipei",
          }),
        }
      );
      expect(applyRes.status).toBe(200);
      applicationId = applyRes.data.application_id;

      // 2. Admin approves
      const approveRes = await authenticatedRequest<any>(
        `/api/admin/contract-applications/${applicationId}`,
        adminToken,
        {
          method: "PUT",
          body: JSON.stringify({ status: "approved" }),
        }
      );
      expect(approveRes.status).toBe(200);
      expect(approveRes.data.success).toBe(true);

      // 3. Check bill generation (was BILL-FLOW-002)
      const res = await authenticatedRequest<any>(
        "/api/billing/bills",
        newUserToken
      );
      
      expect(res.status).toBe(200);
      expect(res.data.bills.length).toBeGreaterThan(0);
      
      const bill = res.data.bills[0];
      expect(bill.status).toBe("pending");
      billId = bill.id;

      // 4. Admin manual adjustment (was BILL-FLOW-003)
      const updateRes = await authenticatedRequest<any>(
        `/api/admin/billing/bills/${billId}`,
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify({
            total_amount: 500,
            notes: "Manual adjustment"
          }),
        }
      );
      expect(updateRes.status).toBe(200);
      expect(updateRes.data.success).toBe(true);

      // Verify update
      const getRes = await authenticatedRequest<any>(
        `/api/billing/bills/${billId}`,
        newUserToken
      );
      expect(getRes.data.bill.total_amount).toBe(500);

      // 5. Settlement (was BILL-FLOW-004)
      const now = new Date();
      const cycle = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const settleRes = await authenticatedRequest<any>(
        "/api/admin/billing/settle",
        adminToken,
        {
          method: "POST",
          body: JSON.stringify({ cycle_year_month: cycle }),
        }
      );

      expect(settleRes.status).toBe(200);
      expect(settleRes.data.success).toBe(true);
    });
  });
  describe401Tests([
    { method: "GET", path: "/api/billing/bills" },
    { method: "GET", path: "/api/billing/bills/123" },
    { method: "POST", path: "/api/billing/payments", body: { bill_id: "123", payment_method: "credit_card", amount: 100 } },
    { method: "GET", path: "/api/billing/payments" },
    { method: "POST", path: "/api/admin/billing/settle", body: { cycle_year_month: "2023-01" } },
    { method: "PATCH", path: "/api/admin/billing/bills/123", body: { total_amount: 100 } },
  ]);
});
