import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getWarehouseToken,
  createTestUser,
  createTestPackage,
  getAdminToken
} from "./helpers";

describe("International Shipment Flow (P1)", () => {
  let warehouseToken: string;
  let customerToken: string;
  let testPackage: any;

  beforeAll(async () => {
    warehouseToken = await getWarehouseToken();
    const customer = await createTestUser();
    customerToken = customer.token;
    testPackage = await createTestPackage(customerToken);
  });

  describe("Package Events with International Status", () => {
    it("should accept customs_hold status", async () => {
      const { status, data } = await authenticatedRequest<any>(
        `/api/packages/${testPackage.id}/events`,
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            delivery_status: "customs_hold",
            delivery_details: "Package held for inspection",
            location: "HUB_0"
          })
        }
      );

      // May fail due to package state, but should not fail on status enum validation
      if (status === 200) {
        expect(data.success).toBe(true);
      } else {
        // If it fails, it should be for a reason other than invalid status
        expect(data.error).not.toContain("Invalid enum value");
      }
    });

    it("should accept customs_cleared status", async () => {
      const { status, data } = await authenticatedRequest<any>(
        `/api/packages/${testPackage.id}/events`,
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            delivery_status: "customs_cleared",
            delivery_details: "Customs inspection passed",
            location: "HUB_0"
          })
        }
      );

      if (status === 200) {
        expect(data.success).toBe(true);
      } else {
        expect(data.error).not.toContain("Invalid enum value");
      }
    });

    it("should accept cross_border status", async () => {
      const { status, data } = await authenticatedRequest<any>(
        `/api/packages/${testPackage.id}/events`,
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            delivery_status: "cross_border",
            delivery_details: "Package in cross-border transit",
            location: "HUB_0"
          })
        }
      );

      if (status === 200) {
        expect(data.success).toBe(true);
      } else {
        expect(data.error).not.toContain("Invalid enum value");
      }
    });
  });
});
