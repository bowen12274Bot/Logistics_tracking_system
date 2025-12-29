import { describe, it, expect, beforeAll } from "vitest";
import { 
  authenticatedRequest,
  getDriverToken,
  getAdminToken,
  createTestUser,
  createTestPackage,
  getWarehouseToken
} from "./helpers";

describe("Delivery Signature (P2)", () => {
  let adminToken: string;
  let driverToken: string;
  let warehouseToken: string;
  let customerToken: string;
  let testPackage: any;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    driverToken = await getDriverToken();
    warehouseToken = await getWarehouseToken();
    const customer = await createTestUser();
    customerToken = customer.token;
    
    // Create a package that can be delivered
    testPackage = await createTestPackage(customerToken, {
      sender_address: "END_HOME_1",
      receiver_address: "END_HOME_5",
      payment_type: "prepaid",
      payment_method: "credit_card"
    });
  });

  describe("DriverTaskDropoff with signature", () => {
    it("should accept optional signature and signed_by in request body", async () => {
      // This test verifies the schema accepts signature fields
      // The full flow requires a valid task in progress state
      // We test the API accepts the body shape without error
      
      // Attempt to call dropoff with signature data (will fail due to no task, but tests schema)
      const { status, data } = await authenticatedRequest<any>(
        "/api/driver/tasks/fake-task-id/dropoff",
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({
            signature: "data:image/png;base64,iVBORw0KGgo=",
            signed_by: "John Doe"
          })
        }
      );
      
      // Should fail with 404 (task not found), not 400 (bad request schema)
      expect(status).toBe(404);
      expect(data.error).toContain("Task not found");
    });

    it("should allow dropoff without signature (optional fields)", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/driver/tasks/fake-task-id/dropoff",
        driverToken,
        {
          method: "POST",
          body: JSON.stringify({}) // No signature data
        }
      );
      
      // Should fail with 404 (task not found), not 400
      expect(status).toBe(404);
    });
  });
});
