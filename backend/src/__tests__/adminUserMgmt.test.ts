import { describe, it, expect, beforeAll } from "vitest";
import { 
  getAdminToken, 
  createEmployeeUser, 
  authenticatedRequest,
  apiRequest
} from "./helpers";

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
});
