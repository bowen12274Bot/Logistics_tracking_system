import { describe } from "vitest";
import { describe401Tests } from "./authTestUtils";
import { authenticatedRequest, createTestPackage, createTestUser, getAdminToken, createEmployeeUser, apiRequest } from "./helpers";
import { expect, it, beforeAll } from "vitest";

describe("Warehouse API Authentication", () => {
  describe401Tests([
    { method: "GET", path: "/api/warehouse/packages" },
    { method: "POST", path: "/api/warehouse/packages/receive", body: { package_ids: ["PKG123"] } },
    { method: "POST", path: "/api/warehouse/batch-operation", body: { operation: "receive", package_ids: ["PKG123"] } },
    { method: "POST", path: "/api/warehouse/packages/PKG123/dispatch-next", body: { toNodeId: "HUB_1" } },
  ]);
});

describe("Warehouse Functional Tests", () => {
  let warehouseToken: string;
  let customerToken: string;
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const whUser = await createEmployeeUser(adminToken, "warehouse_staff", { address: "HUB_0" });
    warehouseToken = whUser.token;
    
    const user = await createTestUser();
    customerToken = user.token;
  });

  it("WH-RCV-002: receive with empty package_ids returns 400", async () => {
    const res = await authenticatedRequest<any>(
      "/api/warehouse/packages/receive",
      warehouseToken,
      { method: "POST", body: JSON.stringify({ package_ids: [] }) }
    );
    expect(res.status).toBe(400);
  });

  it("WH-DISP-002: dispatch to non-adjacent node returns 400", async () => {
    // Create a package at HUB_0
    const pkg = await createTestPackage(customerToken, { sender_address: "END_HOME_1" });
    // Simulate it arrived at HUB_0 (via DB or event)
    // Or just use existing package.
    // We need to inject "warehouse_in" at HUB_0 to be eligible for dispatch?
    // Dispatch endpoint usually checks if package is AT the node.
    // Let's rely on loose check or setup properly.
    // Setup: Simulate package arriving AND receiving at HUB_0
    // Dispatch endpoint requires status to be 'sorting' or 'warehouse_received'
    // So we invoke receive API or manually insert events. Manual is easier for setup speed.
    const now = new Date().toISOString();
    await apiRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "warehouse_in", location: "HUB_0" }),
    });
    // Insert warehouse_received
    await apiRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "warehouse_received", location: "HUB_0" }),
    });
    // Insert sorting
    await apiRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "sorting", location: "HUB_0" }),
    });

    // Try dispatch to far away node (e.g. HUB_9999)
    const res = await authenticatedRequest<any>(
      `/api/warehouse/packages/${encodeURIComponent(pkg.id)}/dispatch-next`,
      warehouseToken,
      { method: "POST", body: JSON.stringify({ toNodeId: "HUB_9999" }) }
    );
    // If HUB_9999 doesn't exist, it might be 400 or 404? 
    // If it exists but not adjacent -> 400.
    // The plan says "non-adjacent returns 400".
    expect(res.status).toBe(400); 
  });
  it("WH-RCV-003: should list packages at warehouse", async () => {
    // Must use valid END addresses for creation
    const pkg = await createTestPackage(customerToken, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });
    
    // Ensure "warehouse_received" is strictly later than "created"
    // "created" uses Date.now().toISOString() in packageCreate.
    // We add 2 seconds.
    const future = new Date(Date.now() + 2000).toISOString();
    
    // Simulate package arrival at HUB_0
    // We manually insert event to control timestamp if needed, or use apiRequest with timestamp payload if supported?
    // /events endpoint accepts body... delivery_status, etc. 
    // It sets events_at = new Date().toISOString() inside handle().
    // So we rely on sleep? Or just wait? 
    // A loop check? 
    // Wait, testing environment might freeze time?
    // No, usually not. 
    // Let's use `setTimeout` delay before calling apiRequest.
    await new Promise(r => setTimeout(r, 100)); // 100ms delay

    await apiRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "warehouse_received", location: "HUB_0" }), 
    });
    
    // Check list
    const res = await authenticatedRequest<any>(
      "/api/warehouse/packages?status=warehouse_received",
      warehouseToken,
      { method: "GET" }
    );
    console.log("Warehouse response status:", res.status);
    console.log("Warehouse response data:", JSON.stringify(res.data, null, 2));
    expect(res.status).toBe(200);
    const found = (res.data.packages || []).find((p: any) => p.id === pkg.id);
    // Debug log if not found
    if (!found) {
        // console.log("Package not found in list:", res.data.packages);
    }
    expect(found).toBeDefined();
  });
});
