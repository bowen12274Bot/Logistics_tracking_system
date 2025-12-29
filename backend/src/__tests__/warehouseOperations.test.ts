import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getWarehouseToken,
  getAdminToken,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("Warehouse Batch Operations API", () => {
  let warehouseToken: string;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    warehouseToken = await getWarehouseToken();
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("POST /api/warehouse/batch-operation", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        "",
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: ["pkg-1"],
            location_id: "HUB_0",
          }),
        }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-warehouse user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: ["pkg-1"],
            location_id: "HUB_0",
          }),
        }
      );
      expect(status).toBe(403);
    });

    it("should return 400 for empty package_ids", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: [],
            location_id: "HUB_0",
          }),
        }
      );
      expect(status).toBe(400);
    });

    it("should handle warehouse_in operation with valid packages", async () => {
      // Create a test package
      const testPackage = await createTestPackage(customerToken, {
        sender_address: "END_HOME_1",
        receiver_address: "END_HOME_5",
        payment_type: "prepaid",
        payment_method: "credit_card",
      });

      const { status, data } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: [testPackage.id],
            location_id: "HUB_0",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.operation).toBe("warehouse_in");
    });

    it("should handle warehouse_out operation", async () => {
      const testPackage = await createTestPackage(customerToken, {
        sender_address: "END_HOME_2",
        receiver_address: "END_HOME_6",
        payment_type: "prepaid",
        payment_method: "credit_card",
      });

      const { status, data } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_out",
            package_ids: [testPackage.id],
            location_id: "HUB_0",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.operation).toBe("warehouse_out");
    });

    it("should handle sorting operation", async () => {
      const testPackage = await createTestPackage(customerToken, {
        sender_address: "END_HOME_3",
        receiver_address: "END_HOME_7",
        payment_type: "prepaid",
        payment_method: "credit_card",
      });

      const { status, data } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "sorting",
            package_ids: [testPackage.id],
            location_id: "HUB_0",
            note: "Sorted for delivery",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.operation).toBe("sorting");
    });

    it("should report failed packages that don't exist", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: ["non-existent-pkg-1", "non-existent-pkg-2"],
            location_id: "HUB_0",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.failed).toBe(2);
      expect(data.details.failed.length).toBe(2);
    });

    it("should handle mixed valid and invalid packages", async () => {
      const testPackage = await createTestPackage(customerToken, {
        sender_address: "END_HOME_4",
        receiver_address: "END_HOME_8",
        payment_type: "prepaid",
        payment_method: "credit_card",
      });

      const { status, data } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        warehouseToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: [testPackage.id, "non-existent-pkg"],
            location_id: "HUB_0",
          }),
        }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(1);
      expect(data.failed).toBe(1);
    });
  });
});
