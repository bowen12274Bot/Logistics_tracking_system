import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getDriverToken,
  getAdminToken,
  createTestUser,
  createTestPackage,
  getWarehouseToken,
} from "./helpers";

describe("Driver Collect Cash API", () => {
  let driverToken: string;
  let adminToken: string;
  let customerToken: string;
  let warehouseToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    driverToken = await getDriverToken();
    warehouseToken = await getWarehouseToken();
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("POST /api/driver/packages/:packageId/collect-cash", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/packages/pkg-123/collect-cash",
        "",
        { method: "POST" }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-driver user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/packages/pkg-123/collect-cash",
        customerToken,
        { method: "POST" }
      );
      expect(status).toBe(403);
    });

    it("should return 404 for non-existent package", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/driver/packages/non-existent-pkg/collect-cash",
        driverToken,
        { method: "POST" }
      );
      expect(status).toBe(404);
      expect(data.error).toContain("not found");
    });

    it("should return 409 for package without active task", async () => {
      // Create a prepaid package (driver has no active task for it)
      const testPackage = await createTestPackage(customerToken, {
        sender_address: "END_HOME_1",
        receiver_address: "END_HOME_5",
        payment_type: "prepaid",
        payment_method: "cash",
      });

      const { status, data } = await authenticatedRequest<any>(
        `/api/driver/packages/${testPackage.id}/collect-cash`,
        driverToken,
        { method: "POST" }
      );
      
      // Should fail because driver has no active task for this package
      expect([404, 409]).toContain(status);
    });
  });
});
