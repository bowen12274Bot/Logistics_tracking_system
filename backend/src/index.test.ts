import { describe, it, expect } from "vitest";
import { apiRequest, uniqueEmail } from "./__tests__/helpers";

describe("Backend API Tests", () => {
  // ========== Hello API ==========
  describe("GET /api/hello", () => {
    it("should return hello message", async () => {
      const { status, data } = await apiRequest<{ message: string }>("/api/hello");
      expect(status).toBe(200);
      expect(data.message).toBe("Hello from Worker!");
    });
  });

  // ========== Map APIs ==========
  describe("Map APIs", () => {
    it("GET /api/map should return nodes and edges", async () => {
      const { status, data } = await apiRequest<{ success: boolean; nodes: any[]; edges: any[] }>("/api/map");
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
    });

    it("PUT /api/map/edges/:id should handle non-existent edge", async () => {
      const { status } = await apiRequest(`/api/map/edges/999999`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost: 100 }),
      });
      expect([404, 500]).toContain(status);
    });
  });

  // ========== Auth APIs ==========
  describe("Auth APIs", () => {
    const testPassword = "password123";
    const testUserName = "Test User";

    it("POST /api/auth/register should create new user", async () => {
      const testEmail = uniqueEmail();
      const { status, data } = await apiRequest<{ user: { email: string }; token: string }>(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: testUserName,
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
      expect(data.token).toBeDefined();
    });

    it("POST /api/auth/register should fail with missing fields", async () => {
      const { status } = await apiRequest(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "incomplete@example.com" }),
      });
      expect(status).toBe(400);
    });

    it("POST /api/auth/login should authenticate user", async () => {
      const testEmail = uniqueEmail();

      const register = await apiRequest<{ user: { email: string }; token: string }>(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: testUserName,
          email: testEmail,
          password: testPassword,
        }),
      });
      expect(register.status).toBe(200);

      const { status, data } = await apiRequest<{ user: { email: string }; token: string }>(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: testEmail,
          password: testPassword,
        }),
      });
      expect(status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
    });
  });

  // ========== Package APIs (T3 & T4) ==========
  describe("Package APIs", () => {
    it("POST /api/packages should create package", async () => {
      const email = `package_${Date.now()}@example.com`;
      const senderName = "Package User";

      const regResponse = await apiRequest<{ user: { id: string }; token: string }>(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: senderName,
          email,
          password: "password123",
        }),
      });
      const customerId = regResponse.data.user.id;

      const { status, data } = await apiRequest<{ success: boolean; package: any }>(`/api/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          sender: senderName,
          receiver: "Receiver Test",
          weight: 5,
          size: "medium",
          delivery_time: "standard",
          payment_type: "prepaid",
          payment_method: "credit_card",
          dangerous_materials: false,
          fragile_items: true,
          international_shipments: false,
          pickup_date: "2025-01-01",
          pickup_time_window: "09:00-12:00",
          pickup_notes: "請提前聯絡",
          route_path: '["HUB_0","REG_1"]',
        }),
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.package.size).toBe("medium");
      expect(data.package.delivery_time).toBe("standard");
      expect(data.package.tracking_number).toBeDefined();
    });
  });
});
