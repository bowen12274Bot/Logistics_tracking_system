import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getAdminToken,
  createTestUser,
  createTestPackage,
  getWarehouseToken,
} from "./helpers";

describe("Tracking Search API", () => {
  let adminToken: string;
  let warehouseToken: string;
  let customerToken: string;
  let customerId: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    warehouseToken = await getWarehouseToken();
    const customer = await createTestUser();
    customerToken = customer.token;
    customerId = customer.userId;
    
    // Create a test package for search
    await createTestPackage(customerToken, {
      sender_address: "END_HOME_1",
      receiver_address: "END_HOME_5",
    });
  });

  describe("GET /api/tracking/search", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/tracking/search",
        "",
        { method: "GET" }
      );
      expect(status).toBe(401);
    });

    it("should return packages for customer", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search",
        customerToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.packages)).toBe(true);
    });

    it("should return packages for warehouse staff", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search",
        warehouseToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return packages for admin", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should filter by tracking_number", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?tracking_number=TRK",
        customerToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should filter by date range", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?date_from=2025-01-01&date_to=2025-12-31",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should filter by status_group=in_transit", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?status_group=in_transit",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should filter by status_group=history", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?status_group=history",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should filter by exception_only", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?exception_only=true",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return 400 for conflicting location_id and vehicle_id", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?location_id=HUB_0&vehicle_id=VEH_1",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(400);
      expect(data.error).toContain("cannot be used together");
    });

    it("should filter by customer_id for admin", async () => {
      const { status, data } = await authenticatedRequest<any>(
        `/api/tracking/search?customer_id=${customerId}`,
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return 404 for non-existent customer_account", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/tracking/search?customer_account=nonexistent@test.com",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(404);
      expect(data.error).toContain("Customer not found");
    });
  });
});
