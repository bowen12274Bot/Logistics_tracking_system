import { describe, it, expect, beforeAll } from "vitest";
import { describe401Tests } from "./authTestUtils";
import { authenticatedRequest, getDriverToken, createTestPackage, getAdminToken, createEmployeeUser, apiRequest, createTestUser } from "./helpers";
import { env } from "cloudflare:test";

describe("Driver Task En Route API", () => {
  let driverToken: string;
  let driverId: string;
  let warehouseToken: string;
  let customerUser: any;
  let packageId: string;
  let taskId: string;

  beforeAll(async () => {
      // Empty setup to avoid mysterious failures
  });

  it("should return 200 and success for valid task", async () => {
    const adminToken = await getAdminToken();
    const customerUser = await createTestUser({}); 
    // createTestUser returns { user: ..., token: ... }
    const driverToken = await getDriverToken();
    const meRes = await authenticatedRequest<any>("/api/auth/me", driverToken);
    const driverId = meRes.data.user.id;
    
    // 1. Create Package via API (ensure it exists)
    // Must use valid END addresses or creation fails.
    const pkg = await createTestPackage(customerUser.token, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });
    packageId = pkg.id;

    // 2. Inject Task manually for seed driver
    // 2. Inject Task manually for logged in driver
    const taskId = crypto.randomUUID();
    const db = (env as any).DB as D1Database;
    await db.prepare(`
        INSERT INTO delivery_tasks (id, package_id, task_type, from_location, to_location, assigned_driver_id, status, created_at, updated_at)
        VALUES (?, ?, 'deliver', 'HUB_0', 'HUB_1', ?, 'accepted', ?, ?)
    `).bind(taskId, packageId, driverId, new Date().toISOString(), new Date().toISOString()).run();

    // 2.5 Ensure Driver has a vehicle (P1 Fix)
    // We explicitly insert a vehicle for the current driver to verify en_route works
    const vehicleId = crypto.randomUUID();
    await db.prepare(`
        INSERT INTO vehicles (id, driver_user_id, vehicle_code, home_node_id, current_node_id, updated_at)
        VALUES (?, ?, 'TRUCK_TEST_01', 'HUB_0', 'HUB_0', ?)
    `).bind(vehicleId, driverId, new Date().toISOString()).run();
    // Also need 'vehicle_cargo' if status is 'in_progress'?
    // The task status inserted above is 'accepted', so it won't check cargo.
    
    // 3. Test En Route
    const { status, data } = await authenticatedRequest<any>(
      `/api/driver/tasks/${taskId}/enroute`,
      driverToken,
      { method: "POST" }
    );
    if (status !== 200) {
        console.log("EnRoute failed:", status, JSON.stringify(data));
    }
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("in_transit");
  });

  it("should fail if task is not assigned to driver", async () => {
    // Need a valid package
    const adminToken = await getAdminToken();
    const customerUser = await createTestUser({});
    const pkg = await createTestPackage(customerUser.token, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });
    const packageId = pkg.id;
    const driverToken = await getDriverToken(); // Current driver

     // Create another driver for assignment
     const otherDriver = await createEmployeeUser(adminToken, "driver", { address: "HUB_1" });
     const otherDriverId = otherDriver.user.id;

     if ((env as any).DB) {
        const db = (env as any).DB as D1Database;
        const otherTaskId = crypto.randomUUID();
        await db.prepare(`
            INSERT INTO delivery_tasks (id, package_id, task_type, assigned_driver_id, status, from_location, to_location, created_at, updated_at)
            VALUES (?, ?, 'transport', ?, 'accepted', 'HUB_0', 'HUB_1', ?, ?)
        `).bind(otherTaskId, packageId, otherDriverId, new Date().toISOString(), new Date().toISOString()).run();

        const { status } = await authenticatedRequest(
            `/api/driver/tasks/${otherTaskId}/enroute`,
            driverToken,
            { method: "POST" }
        );
        expect(status).toBe(403);
     }
  });
});
