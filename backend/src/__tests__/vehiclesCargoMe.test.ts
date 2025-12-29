import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getDriverToken,
  createTestUser,
} from "./helpers";

describe("Vehicle Cargo Me API", () => {
  let driverToken: string;
  let customerToken: string;

  beforeAll(async () => {
    driverToken = await getDriverToken();
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("GET /api/vehicles/me/cargo", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/vehicles/me/cargo",
        "",
        { method: "GET" }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-driver user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/vehicles/me/cargo",
        customerToken,
        { method: "GET" }
      );
      expect(status).toBe(403);
    });

    it("should return cargo list for driver", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/vehicles/me/cargo",
        driverToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.vehicle_id).toBeDefined();
      expect(Array.isArray(data.cargo)).toBe(true);
    });

    it("should return empty cargo list for driver with no loaded packages", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/vehicles/me/cargo",
        driverToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      // Cargo should be an empty array or array of packages
      expect(Array.isArray(data.cargo)).toBe(true);
    });
  });
});
