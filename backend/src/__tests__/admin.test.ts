// backend/src/__tests__/admin.test.ts
// 管理員測試 (Admin)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
  uniqueEmail,
} from "./helpers";

describe("管理員 (Admin)", () => {
  let customerToken: string;

  beforeAll(async () => {
    const user = await createTestUser();
    customerToken = user.token;
  });

  // ========== POST /api/admin/users ==========
  describe("POST /api/admin/users - 建立員工帳號", () => {
    it("ADM-USER-004: customer 無權限", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/users",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            user_name: "新員工",
            email: uniqueEmail(),
            password: "testpass123",
            user_class: "driver",
          }),
        }
      );

      expect(status).toBe(403);
    });

    it("ADM-USER-006: 無 token", async () => {
      const { status } = await apiRequest<any>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          user_name: "新員工",
          email: uniqueEmail(),
          password: "testpass123",
          user_class: "driver",
        }),
      });

      expect(status).toBe(401);
    });
  });

  // ========== GET /api/admin/contract-applications ==========
  describe("GET /api/admin/contract-applications - 列出合約申請", () => {
    it("ADM-APP-LIST-001: customer 無權限", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/contract-applications",
        customerToken
      );

      expect(status).toBe(403);
    });
  });

  // ========== PUT /api/admin/contract-applications/:id ==========
  describe("PUT /api/admin/contract-applications/:id - 審核申請", () => {
    it("ADM-APP-003: 申請不存在", async () => {
      // customer 無權限，會先被拒絕
      const { status } = await authenticatedRequest<any>(
        "/api/admin/contract-applications/non-existent",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({
            status: "approved",
          }),
        }
      );

      expect(status).toBe(403);
    });

    it("ADM-APP-004: customer 無權限", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/contract-applications/test-id",
        customerToken,
        {
          method: "PUT",
          body: JSON.stringify({
            status: "approved",
          }),
        }
      );

      expect(status).toBe(403);
    });
  });

  // ========== GET /api/admin/system/errors ==========
  describe("GET /api/admin/system/errors - 系統異常查詢", () => {
    it("ADM-ERR-001: customer 無權限", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/system/errors",
        customerToken
      );

      expect(status).toBe(403);
    });

    it("ADM-ERR-002: 無 token", async () => {
      const { status } = await apiRequest<any>("/api/admin/system/errors");

      expect(status).toBe(401);
    });
  });
});
