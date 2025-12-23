// backend/src/__tests__/driverTaskPool.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createEmployeeUser,
  createTestPackage,
  createTestUser,
  getAdminToken,
  getDriverToken,
} from "./helpers";
import { describe401Tests } from "./authTestUtils";

describe("Driver tasks (segmented assignment + handoff)", () => {
  let customerToken: string;
  let driverToken: string;

  beforeAll(async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    customerToken = user.token;
    driverToken = await getDriverToken();
  });

  it("DRV-TASK-SEQ-001: package create only produces initial pickup task", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";

    const pkg = await createTestPackage(customerToken, { sender_address: sender, receiver_address: receiver });

    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const hubs: string[] = (mapRes.data.nodes ?? [])
      .filter((n: any) => Number(n.level) === 1 && typeof n.id === "string")
      .map((n: any) => String(n.id));
    expect(hubs.length).toBeGreaterThan(0);

    const loginDriver = async (hubId: string) => {
      const { status, data } = await apiRequest<{ token: string }>(`/api/auth/login`, {
        method: "POST",
        body: JSON.stringify({ identifier: `driver_${hubId.toLowerCase()}@example.com`, password: "driver123" }),
      });
      expect(status).toBe(200);
      return data.token;
    };

    const allTasks: any[] = [];
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assignedRes = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assignedRes.status).toBe(200);
      expect(assignedRes.data.success).toBe(true);
      const tasks: any[] = (assignedRes.data.tasks ?? []).filter((t: any) => t.package_id === pkg.id);
      allTasks.push(...tasks);
    }

    expect(allTasks.length).toBe(1);
    expect(String(allTasks[0]?.from_location)).toBe(sender);
    expect(String(allTasks[0]?.task_type)).toBe("pickup");
    expect(Number(allTasks[0]?.segment_index)).toBe(0);
  });

  it("DRV-TASK-HANDOFF-001: driver at HUB/REG can take over tasks starting there", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";

    const adminToken = await getAdminToken();

    const pkg = await createTestPackage(customerToken, { sender_address: sender, receiver_address: receiver });

    // Complete the initial pickup task so warehouse can dispatch the next segment.
    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const hubs: string[] = (mapRes.data.nodes ?? [])
      .filter((n: any) => Number(n.level) === 1 && typeof n.id === "string")
      .map((n: any) => String(n.id));
    expect(hubs.length).toBeGreaterThan(0);

    const loginDriver = async (hubId: string) => {
      const { status, data } = await apiRequest<{ token: string }>(`/api/auth/login`, {
        method: "POST",
        body: JSON.stringify({ identifier: `driver_${hubId.toLowerCase()}@example.com`, password: "driver123" }),
      });
      expect(status).toBe(200);
      return data.token;
    };

    let pickup: any | null = null;
    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assignedRes = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      if (assignedRes.status !== 200) {
        throw new Error(`GET /api/driver/tasks failed: status=${assignedRes.status} data=${JSON.stringify(assignedRes.data)}`);
      }
      const hit = (assignedRes.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickup = hit;
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickup).toBeTruthy();
    expect(pickupDriverToken).toBeTruthy();

    const handoffNode = String(pickup.to_location ?? "").trim();
    expect(handoffNode).toMatch(/^(HUB_|REG_)/i);

    const otherDriver = await createEmployeeUser(adminToken, "driver", { address: String(handoffNode) });
    const otherDriverToken = otherDriver.token;

    // Ensure vehicle exists at the driver's home node
    const me = await authenticatedRequest<any>("/api/vehicles/me", otherDriverToken);
    expect(me.status).toBe(200);

    const complete = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickup.id))}/complete`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(complete.status).toBe(200);
    expect(complete.data.success).toBe(true);

    // Pick a valid adjacent next hop from this HUB/REG node.
    const allEdges: any[] = mapRes.data.edges ?? [];
    const nextHopCandidates = allEdges.flatMap((e: any) => {
      const a = String(e.source ?? "").trim();
      const b = String(e.target ?? "").trim();
      if (a === handoffNode) return [b];
      if (b === handoffNode) return [a];
      return [];
    });
    const nextHop = nextHopCandidates.find((n) => n && n !== sender) ?? nextHopCandidates[0] ?? null;
    expect(String(nextHop ?? "")).toBeTruthy();

    // Warehouse receives and dispatches a next segment from this HUB/REG so it's eligible for handoff here.
    const warehouse = await createEmployeeUser(adminToken, "warehouse_staff", { address: String(handoffNode) });

    // Simulate truck unloading at this node so warehouse can receive it.
    const arrive = await apiRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "warehouse_in", location: handoffNode }),
    });
    expect(arrive.status).toBe(200);
    expect(arrive.data.success).toBe(true);

    // Warehouse must receive the package into sorting area before dispatching next hop.
    const receive = await authenticatedRequest<any>(
      `/api/warehouse/packages/receive`,
      warehouse.token,
      { method: "POST", body: JSON.stringify({ package_ids: [pkg.id] }) },
    );
    expect(receive.status).toBe(200);
    expect(receive.data.success).toBe(true);
    expect(Number(receive.data.processed ?? 0)).toBe(1);
    expect(Number(receive.data.failed ?? 0)).toBe(0);

    const dispatch = await authenticatedRequest<any>(
      `/api/warehouse/packages/${encodeURIComponent(pkg.id)}/dispatch-next`,
      warehouse.token,
      { method: "POST", body: JSON.stringify({ toNodeId: nextHop }) },
    );
    expect(dispatch.status).toBe(200);
    expect(dispatch.data.success).toBe(true);

    const handoffRes = await authenticatedRequest<any>("/api/driver/tasks?scope=handoff", otherDriverToken);
    expect(handoffRes.status).toBe(200);
    expect(handoffRes.data.success).toBe(true);

    const candidates: any[] = (handoffRes.data.tasks ?? []).filter(
      (t: any) => t.package_id === pkg.id && String(t.from_location) === String(handoffNode),
    );
    expect(candidates.length).toBeGreaterThan(0);

    const taskId = String(candidates[0].id ?? "");
    expect(taskId).toBeTruthy();

    const accept = await authenticatedRequest<any>(`/api/driver/tasks/${encodeURIComponent(taskId)}/accept`, otherDriverToken, {
      method: "POST",
    });
    expect(accept.status).toBe(200);
    expect(accept.data.success).toBe(true);

    const assigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", otherDriverToken);
    expect(assigned.status).toBe(200);
    const list: any[] = assigned.data.tasks ?? [];
    expect(list.some((t) => t.id === taskId)).toBe(true);
  });
  describe401Tests([
    { method: "GET", path: "/api/driver/tasks" },
    { method: "POST", path: "/api/driver/tasks/123/accept" },
    { method: "POST", path: "/api/driver/tasks/123/pickup" }, // In driverTaskCargo.ts
    { method: "POST", path: "/api/driver/tasks/123/dropoff" }, // In driverTaskCargo.ts
    { method: "POST", path: "/api/driver/tasks/123/complete" },
  ]);
});
