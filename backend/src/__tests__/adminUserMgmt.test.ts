import { describe, it, expect, beforeAll } from "vitest";
import {
  getAdminToken,
  createEmployeeUser,
  authenticatedRequest,
  apiRequest
} from "./helpers";
import { env } from "cloudflare:test";

describe("Admin User Management APIs", () => {
  let adminToken: string;
  let targetUserId: string;
  let driverUserId: string;

  beforeAll(async () => {
    // Get admin token using helper
    adminToken = await getAdminToken();

    // Create a target user to manipulate
    const targetUser = await createEmployeeUser(adminToken, "warehouse_staff");
    targetUserId = targetUser.user.id;

    // Create a driver for vehicle tests
    const driverUser = await createEmployeeUser(adminToken, "driver");
    driverUserId = driverUser.user.id;
  });

  it("GET /api/admin/users - List users", async () => {
    const { status, data } = await authenticatedRequest<any>(
      "/api/admin/users?limit=5",
      adminToken
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
  });

  it("GET /api/admin/users/:id - Get details", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}`,
      adminToken
    );
    expect(status).toBe(200);
    expect(data.user.id).toBe(targetUserId);
  });

  it("PUT /api/admin/users/:id - Update user info", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}`,
      adminToken,
      {
        method: "PUT",
        body: JSON.stringify({ user_name: "Updated Name", phone_number: "0999888777" }),
      }
    );
    expect(status).toBe(200);
    expect(data.user.user_name).toBe("Updated Name");
    expect(data.user.phone_number).toBe("0999888777");
  });

  it("POST /api/admin/users/:id/suspend - Suspend user", async () => {
    const { status } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}/suspend`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({ reason: "Violation" }),
      }
    );
    expect(status).toBe(200);

    // Verify status
    const { data: details } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}`,
      adminToken
    );
    expect(details.user.status).toBe("suspended");
    expect(details.user.suspended_reason).toBe("Violation");
  });

  it("POST /api/admin/users/:id/activate - Activate user", async () => {
    const { status } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}/activate`,
      adminToken,
      { method: "POST" }
    );
    expect(status).toBe(200);

    // Verify status
    const { data: details } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}`,
      adminToken
    );
    expect(details.user.status).toBe("active");
    expect(details.user.suspended_reason).toBeNull();
  });

  it("POST /api/admin/users/:id/assign-vehicle - Assign vehicle", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/admin/users/${driverUserId}/assign-vehicle`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({ vehicle_code: "TEST_TRUCK_999", home_node_id: "HUB_0" }),
      }
    );
    expect(status).toBe(200);
    expect(data.vehicle.vehicle_code).toBe("TEST_TRUCK_999");
    expect(data.vehicle.driver_user_id).toBe(driverUserId);
  });

  it("GET /api/admin/users/:id/work-stats", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}/work-stats`,
      adminToken
    );
    expect(status).toBe(200);
    expect(data.user_id).toBe(targetUserId);
    expect(data.stats).toBeDefined();
  });

  it("DELETE /api/admin/users/:id - Soft delete", async () => {
    const { status } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}`,
      adminToken,
      { method: "DELETE" }
    );
    expect(status).toBe(200);

    // Verify status
    const { data: details } = await authenticatedRequest<any>(
      `/api/admin/users/${targetUserId}`,
      adminToken
    );
    expect(details.user.status).toBe("deleted");
    expect(details.user.deleted_at).toBeDefined();
  });

  it("DELETE /api/admin/users/:id - Deleting driver unbinds vehicle", async () => {
    // 1. Create a new driver (driver2)
    const driver2 = await createEmployeeUser(adminToken, "driver");
    const driver2Id = driver2.user.id;

    // 2. Assign a vehicle
    const vehicleCode = "TEST_TRUCK_DELETE_BIND";
    const { status: assignStatus } = await authenticatedRequest<any>(
      `/api/admin/users/${driver2Id}/assign-vehicle`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({ vehicle_code: vehicleCode, home_node_id: "HUB_0" }),
      }
    );
    expect(assignStatus).toBe(200);

    // 3. Delete the driver
    const { status: deleteStatus } = await authenticatedRequest<any>(
      `/api/admin/users/${driver2Id}`,
      adminToken,
      { method: "DELETE" }
    );
    expect(deleteStatus).toBe(200);

    // 4. Verify vehicle is unbound (deleted from vehicles table)
    // We can verify this by trying to assign the SAME vehicle code to another driver.
    // If the previous binding still exists, it would fail with 409 (unique constraint or check).
    // Or we can query the driver's vehicle list if such API existed, but re-assigning is a good integration check.

    const driver3 = await createEmployeeUser(adminToken, "driver");
    const driver3Id = driver3.user.id;

    const { status: reassignStatus, data: reassignData } = await authenticatedRequest<any>(
      `/api/admin/users/${driver3Id}/assign-vehicle`,
      adminToken,
      {
        method: "POST",
        body: JSON.stringify({ vehicle_code: vehicleCode, home_node_id: "HUB_0" }),
      }
    );

    // Should succeed because previous record was deleted
    expect(reassignStatus).toBe(200);
    expect(reassignData.vehicle.vehicle_code).toBe(vehicleCode);
    expect(reassignData.vehicle.driver_user_id).toBe(driver3Id);
  });

  it("POST /api/admin/users/:id/assign-vehicle - Can claim vehicle code from deleted driver record", async () => {
    if (!(env as any).DB) return;
    const db = (env as any).DB as D1Database;

    const driverA = await createEmployeeUser(adminToken, "driver");
    const driverAId = driverA.user.id;
    const driverB = await createEmployeeUser(adminToken, "driver");
    const driverBId = driverB.user.id;

    const vehicleCode = "TEST_TRUCK_DELETED_OWNER";
    const { status: assignAStatus } = await authenticatedRequest<any>(
      `/api/admin/users/${driverAId}/assign-vehicle`,
      adminToken,
      { method: "POST", body: JSON.stringify({ vehicle_code: vehicleCode, home_node_id: "HUB_0" }) },
    );
    expect(assignAStatus).toBe(200);

    // Simulate soft-deleted driver where vehicle row still exists (e.g. cargo history prevents deletion).
    await db.prepare("UPDATE users SET status = 'deleted' WHERE id = ?").bind(driverAId).run();

    const { status: assignBStatus, data: assignBData } = await authenticatedRequest<any>(
      `/api/admin/users/${driverBId}/assign-vehicle`,
      adminToken,
      { method: "POST", body: JSON.stringify({ vehicle_code: vehicleCode, home_node_id: "HUB_0" }) },
    );
    expect(assignBStatus).toBe(200);
    expect(assignBData.vehicle.vehicle_code).toBe(vehicleCode);
    expect(assignBData.vehicle.driver_user_id).toBe(driverBId);
  });
});
