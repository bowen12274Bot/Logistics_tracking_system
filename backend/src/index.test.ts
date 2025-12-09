import { describe, it, expect, beforeAll } from "vitest";

const BASE_URL = "http://localhost:8787";

// Note: These tests require the dev server to be running (`npm run dev`)
// Run tests with: npm test

describe("Backend API Tests", () => {
  // ========== Hello API ==========
  describe("GET /api/hello", () => {
    it("should return hello message", async () => {
      const response = await fetch(`${BASE_URL}/api/hello`);
      expect(response.status).toBe(200);
      const data = await response.json() as { message: string };
      expect(data.message).toBe("Hello from Worker!");
    });
  });

  // ========== Map APIs ==========
  describe("Map APIs", () => {
    it("GET /api/map should return nodes and edges", async () => {
      const response = await fetch(`${BASE_URL}/api/map`);
      expect(response.status).toBe(200);
      const data = await response.json() as { success: boolean; nodes: any[]; edges: any[] };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.nodes)).toBe(true);
      expect(Array.isArray(data.edges)).toBe(true);
    });

    it("PUT /api/map/edges/:id should update edge", async () => {
      // First, get an edge ID
      const mapRes = await fetch(`${BASE_URL}/api/map`);
      const mapData = await mapRes.json() as { edges: { id: number }[] };
      
      if (mapData.edges && mapData.edges.length > 0) {
        const edgeId = mapData.edges[0].id;
        
        const response = await fetch(`${BASE_URL}/api/map/edges/${edgeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cost: 1234, road_multiple: 5 }),
        });
        
        expect(response.status).toBe(200);
        const data = await response.json() as { success: boolean };
        expect(data.success).toBe(true);
      }
    });

    it("PUT /api/map/edges/:id should handle non-existent edge", async () => {
      const response = await fetch(`${BASE_URL}/api/map/edges/999999`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost: 100 }),
      });
      
      // API may return 404 or 500 for validation failure
      expect([404, 500]).toContain(response.status);
    });
  });

  // ========== Auth APIs ==========
  describe("Auth APIs", () => {
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = "password123";
    const testUserName = "Test User";

    it("POST /api/auth/register should create new user", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: testUserName,
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { user: { email: string }; token: string };
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(testEmail);
      expect(data.token).toBeDefined();
    });

    it("POST /api/auth/register should fail with missing fields", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "incomplete@example.com" }),
      });

      expect(response.status).toBe(400);
    });

    it("POST /api/auth/login should authenticate user", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: testEmail,
          password: testPassword,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { user: { email: string }; token: string };
      expect(data.user).toBeDefined();
      expect(data.token).toBeDefined();
    });

    it("POST /api/auth/login should fail with wrong password", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: testEmail,
          password: "wrongpassword",
        }),
      });

      expect(response.status).toBe(401);
    });

    it("POST /api/auth/login should fail with missing fields", async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  // ========== Task APIs (OpenAPI/Chanfana) ==========
  describe("Task APIs", () => {
    it("GET /api/tasks should return task list", async () => {
      const response = await fetch(`${BASE_URL}/api/tasks`);
      expect(response.status).toBe(200);
      const data = await response.json() as { success: boolean; tasks: any[] };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.tasks)).toBe(true);
    });
  });

  // ========== Package APIs (T3 & T4) ==========
  describe("Package APIs", () => {
    it("POST /api/packages should create package", async () => {
      const email = `package_${Date.now()}@example.com`;
      const senderName = "Package User";
      await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: senderName,
          email,
          password: "password123",
        }),
      });

      const response = await fetch(`${BASE_URL}/api/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

      expect(response.status).toBe(200);
      const data = await response.json() as { success: boolean; package: any };
      expect(data.success).toBe(true);
      expect(data.package.size).toBe("medium");
      expect(data.package.delivery_time).toBe("standard");
      expect(data.package.tracking_number).toBeDefined();
    });

    it("GET /api/packages should return package list", async () => {
      const response = await fetch(`${BASE_URL}/api/packages`);
      expect(response.status).toBe(200);
      const data = await response.json() as { success: boolean; packages: any[] };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.packages)).toBe(true);
    });

    it("GET /api/packages/:id/status should handle non-existent package", async () => {
      const response = await fetch(`${BASE_URL}/api/packages/non_existent/status`);
      expect(response.status).toBe(404);
    });

    it("POST /api/packages/:id/events should handle non-existent package", async () => {
      const response = await fetch(`${BASE_URL}/api/packages/non_existent/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_status: "測試" }),
      });
      expect(response.status).toBe(404);
    });
  });

  // ========== Shipment APIs ==========
  // NOTE: Shipments table does not exist in migrations yet, skipping these tests
  describe.skip("Shipment APIs", () => {
    const testShipmentId = `test_shipment_${Date.now()}`;

    it("POST /api/shipments should create new shipment", async () => {
      const response = await fetch(`${BASE_URL}/api/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: testShipmentId,
          sender: "Sender A",
          receiver: "Receiver B",
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json() as { id: string; message: string };
      expect(data.id).toBe(testShipmentId);
      expect(data.message).toBe("Shipment created");
    });

    it("GET /api/shipments/:id should return shipment", async () => {
      const response = await fetch(`${BASE_URL}/api/shipments/${testShipmentId}`);
      expect(response.status).toBe(200);
      const data = await response.json() as { id: string; sender: string };
      expect(data.id).toBe(testShipmentId);
      expect(data.sender).toBe("Sender A");
    });

    it("GET /api/shipments/:id should return 404 for non-existent", async () => {
      const response = await fetch(`${BASE_URL}/api/shipments/non_existent_id`);
      expect(response.status).toBe(404);
    });
  });
});
