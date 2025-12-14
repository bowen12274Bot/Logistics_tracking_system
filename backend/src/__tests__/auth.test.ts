// backend/src/__tests__/auth.test.ts
// 認證模組測試 (Auth)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  uniqueEmail,
  uniquePhone,
  createTestUser,
} from "./helpers";

describe("認證模組 (Auth)", () => {
  // ========== POST /api/auth/register ==========
  describe("POST /api/auth/register - 客戶註冊", () => {
    it("AUTH-REG-001: 使用完整有效資料註冊", async () => {
      const { status, data } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試用戶",
          email: uniqueEmail(),
          password: "testpass123",
          phone_number: uniquePhone(),
          address: "10,20",
        }),
      });

      expect(status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
      expect(data.user.email).toBeDefined();
    });

    it("AUTH-REG-002: 缺少 user_name", async () => {
      const { status } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: uniqueEmail(),
          password: "testpass123",
        }),
      });

      expect(status).toBe(400);
    });

    it("AUTH-REG-003: 缺少 email", async () => {
      const { status } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試",
          password: "testpass123",
        }),
      });

      expect(status).toBe(400);
    });

    it("AUTH-REG-004: 缺少 password", async () => {
      const { status } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試",
          email: uniqueEmail(),
        }),
      });

      expect(status).toBe(400);
    });

    it("AUTH-REG-007: 使用已存在的 email", async () => {
      const email = uniqueEmail();

      // 第一次註冊
      await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試1",
          email,
          password: "testpass123",
        }),
      });

      // 第二次用相同 email
      const { status } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試2",
          email,
          password: "testpass123",
        }),
      });

      expect(status).toBe(409);
    });

    it("AUTH-REG-009: 驗證 user_type 固定為 customer", async () => {
      const { status, data } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試",
          email: uniqueEmail(),
          password: "testpass123",
          user_type: "admin", // 嘗試設定為 admin
        }),
      });

      expect(status).toBe(200);
      expect(data.user.user_type).toBe("customer");
    });

    it("AUTH-REG-011: 驗證回傳不包含 password_hash", async () => {
      const { status, data } = await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "測試",
          email: uniqueEmail(),
          password: "testpass123",
        }),
      });

      expect(status).toBe(200);
      expect(data.user.password_hash).toBeUndefined();
      expect(data.user.password).toBeUndefined();
    });
  });

  // ========== POST /api/auth/login ==========
  describe("POST /api/auth/login - 使用者登入", () => {
    let testEmail: string;
    let testPhone: string;
    const testPassword = "testpass123";

    beforeAll(async () => {
      testEmail = uniqueEmail();
      testPhone = uniquePhone();
      await apiRequest<any>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          user_name: "登入測試用戶",
          email: testEmail,
          password: testPassword,
          phone_number: testPhone,
        }),
      });
    });

    it("AUTH-LOGIN-001: 使用 email + 正確密碼登入", async () => {
      const { status, data } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: testEmail,
          password: testPassword,
        }),
      });

      expect(status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
    });

    it("AUTH-LOGIN-002: 使用 phone_number + 正確密碼登入", async () => {
      const { status, data } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: testPhone,
          password: testPassword,
        }),
      });

      expect(status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
    });

    it("AUTH-LOGIN-003: 缺少 identifier", async () => {
      const { status } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          password: testPassword,
        }),
      });

      expect(status).toBe(400);
    });

    it("AUTH-LOGIN-004: 缺少 password", async () => {
      const { status } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: testEmail,
        }),
      });

      expect(status).toBe(400);
    });

    it("AUTH-LOGIN-005: 不存在的帳號", async () => {
      const { status } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: "nonexistent@example.com",
          password: testPassword,
        }),
      });

      expect(status).toBe(401);
    });

    it("AUTH-LOGIN-006: 錯誤的密碼", async () => {
      const { status } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: testEmail,
          password: "wrongpassword",
        }),
      });

      expect(status).toBe(401);
    });

    it("AUTH-LOGIN-007: 空的請求 body", async () => {
      const { status } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({}),
      });

      expect(status).toBe(400);
    });

    it("AUTH-LOGIN-008: 驗證回傳 token 格式正確", async () => {
      const { status, data } = await apiRequest<any>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: testEmail,
          password: testPassword,
        }),
      });

      expect(status).toBe(200);
      // UUID 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(data.token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  // ========== GET /api/auth/me ==========
  describe("GET /api/auth/me - 取得當前使用者", () => {
    let validToken: string;

    beforeAll(async () => {
      const user = await createTestUser();
      validToken = user.token;
    });

    it("AUTH-ME-001: 使用有效 token 取得資訊", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/auth/me",
        validToken
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBeDefined();
    });

    it("AUTH-ME-002: 無 token", async () => {
      const { status } = await apiRequest<any>("/api/auth/me");

      expect(status).toBe(401);
    });

    it("AUTH-ME-003: 無效 token", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/auth/me",
        "invalid-token-12345"
      );

      expect(status).toBe(401);
    });
  });
});
