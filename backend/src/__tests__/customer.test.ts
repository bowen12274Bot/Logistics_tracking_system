// backend/src/__tests__/customer.test.ts
// 客戶管理測試 (Customer)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
} from "./helpers";

describe("客戶管理 (Customer)", () => {
  // ========== PUT /api/customers/me ==========
  describe("PUT /api/customers/me - 更新客戶資料", () => {
    let customerToken: string;

    beforeAll(async () => {
      const user = await createTestUser();
      customerToken = user.token;
    });

    it("CUST-UPD-001: 更新 user_name", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/customers/me",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({ user_name: "新名稱" }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("CUST-UPD-002: 更新 phone_number", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/customers/me",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({ phone_number: "0987654321" }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("CUST-UPD-003: 更新 address", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/customers/me",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({ address: "30,40" }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("CUST-UPD-004: 更新 billing_preference 為 credit_card", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/customers/me",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({ billing_preference: "credit_card" }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("CUST-UPD-005: 非合約客戶設定 monthly 帳單", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/customers/me",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({ billing_preference: "monthly" }),
        }
      );

      expect(status).toBe(403);
    });

    it("CUST-UPD-006: 無 token", async () => {
      const { status } = await apiRequest<any>("/api/customers/me", {
        method: "PUT",
        body: JSON.stringify({ user_name: "新名稱" }),
      });

      expect(status).toBe(401);
    });
  });

  // ========== POST /api/customers/contract-application ==========
  describe("POST /api/customers/contract-application - 申請合約客戶", () => {
    it("CUST-APP-001: 完整資料申請", async () => {
      const user = await createTestUser();

      const { status, data } = await authenticatedRequest<any>(
        "/api/customers/contract-application",
        user.token,
        {
          method: "POST",
          body: JSON.stringify({
            company_name: "測試公司",
            tax_id: "12345678",
            contact_person: "聯絡人",
            contact_phone: "0912345678",
            billing_address: "100,200",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe("pending");
      expect(data.application_id).toBeDefined();
    });

    it("CUST-APP-002: 缺少必填欄位", async () => {
      const user = await createTestUser();

      const { status } = await authenticatedRequest<any>(
        "/api/customers/contract-application",
        user.token,
        {
          method: "POST",
          body: JSON.stringify({
            company_name: "測試公司",
            // 缺少其他必填欄位
          }),
        }
      );

      expect(status).toBe(400);
    });

    it("CUST-APP-004: 已有待審核申請", async () => {
      const user = await createTestUser();

      // 第一次申請
      await authenticatedRequest<any>(
        "/api/customers/contract-application",
        user.token,
        {
          method: "POST",
          body: JSON.stringify({
            company_name: "測試公司",
            tax_id: "12345678",
            contact_person: "聯絡人",
            contact_phone: "0912345678",
            billing_address: "100,200",
          }),
        }
      );

      // 第二次申請
      const { status } = await authenticatedRequest<any>(
        "/api/customers/contract-application",
        user.token,
        {
          method: "POST",
          body: JSON.stringify({
            company_name: "測試公司2",
            tax_id: "87654321",
            contact_person: "聯絡人2",
            contact_phone: "0987654321",
            billing_address: "200,300",
          }),
        }
      );

      expect(status).toBe(403);
    });

    it("CUST-APP-005: 無 token", async () => {
      const { status } = await apiRequest<any>(
        "/api/customers/contract-application",
        {
          method: "POST",
          body: JSON.stringify({
            company_name: "測試公司",
            tax_id: "12345678",
            contact_person: "聯絡人",
            contact_phone: "0912345678",
            billing_address: "100,200",
          }),
        }
      );

      expect(status).toBe(401);
    });
  });
});
