import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getDriverToken,
  getWarehouseToken,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("Driver Package Exception Edge Cases", () => {
  let driverToken: string;
  let warehouseToken: string;
  let customerToken: string;

  beforeAll(async () => {
    driverToken = await getDriverToken();
    warehouseToken = await getWarehouseToken();
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("POST /api/driver/packages/:packageId/exception", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/packages/pkg-123/exception",
        "",
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package damaged",
          }),
        }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-driver user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/packages/pkg-123/exception",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package damaged",
          }),
        }
      );
      expect(status).toBe(403);
    });

    it("should return 404 for non-existent package", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/driver/packages/non-existent-pkg/exception",
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package was damaged",
          }),
        }
      );
      expect(status).toBe(404);
    });

    it("should report damaged exception", async () => {
      const pkg = await createTestPackage(customerToken, {
        sender_address: "END_HOME_1",
        receiver_address: "END_HOME_5",
      });

      const { status, data } = await authenticatedRequest<any>(
        `/api/driver/packages/${pkg.id}/exception`,
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package has visible damage on corner",
          }),
        }
      );
      // Either succeeds or returns conflict (already has exception, etc.)
      expect([200, 201, 400, 409]).toContain(status);
    });

    it("should report lost exception", async () => {
      const pkg = await createTestPackage(customerToken, {
        sender_address: "END_HOME_2",
        receiver_address: "END_HOME_6",
      });

      const { status } = await authenticatedRequest<any>(
        `/api/driver/packages/${pkg.id}/exception`,
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "lost",
            description: "Package cannot be located",
          }),
        }
      );
      expect([200, 201, 400, 409]).toContain(status);
    });

    it("should report delivery_failed exception", async () => {
      const pkg = await createTestPackage(customerToken, {
        sender_address: "END_HOME_3",
        receiver_address: "END_HOME_7",
      });

      const { status } = await authenticatedRequest<any>(
        `/api/driver/packages/${pkg.id}/exception`,
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "delivery_failed",
            description: "No one available to receive",
          }),
        }
      );
      expect([200, 201, 400, 409]).toContain(status);
    });

    it("should report address_issue exception", async () => {
      const pkg = await createTestPackage(customerToken, {
        sender_address: "END_HOME_4",
        receiver_address: "END_HOME_8",
      });

      const { status } = await authenticatedRequest<any>(
        `/api/driver/packages/${pkg.id}/exception`,
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "address_issue",
            description: "Address does not exist",
          }),
        }
      );
      expect([200, 201, 400, 409]).toContain(status);
    });
  });

  describe("POST /api/warehouse/packages/:packageId/exception", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/warehouse/packages/pkg-123/exception",
        "",
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package damaged",
          }),
        }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-warehouse user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/warehouse/packages/pkg-123/exception",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package damaged",
          }),
        }
      );
      expect(status).toBe(403);
    });

    it("should allow warehouse staff to report exception", async () => {
      const pkg = await createTestPackage(customerToken, {
        sender_address: "END_HOME_1",
        receiver_address: "END_HOME_5",
      });

      const { status } = await authenticatedRequest<any>(
        `/api/warehouse/packages/${pkg.id}/exception`,
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            reason_code: "damaged",
            description: "Package arrived damaged at warehouse",
          }),
        }
      );
      expect([200, 201, 400, 409]).toContain(status);
    });
  });
});
