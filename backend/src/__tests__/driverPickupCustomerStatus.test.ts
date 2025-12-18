import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestPackage, createTestUser, getDriverToken } from "./helpers";

describe("Customer sees status updates after driver pickup", () => {
  let customerToken: string;
  let driverHub0Token: string;

  beforeAll(async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    customerToken = user.token;
    driverHub0Token = await getDriverToken();
  });

  it("DRV-PICK-001: customer package status shows picked_up after driver updates", async () => {
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

    let pickupTask: any | null = null;
    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverHub0Token : await loginDriver(hubId);
      const assignedRes = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assignedRes.status).toBe(200);
      const hit = (assignedRes.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickupTask = hit;
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickupTask).toBeTruthy();
    expect(pickupDriverToken).toBeTruthy();

    const updateStatus = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/status`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ status: "picked_up", note: "picked up", location: sender }) },
    );
    expect(updateStatus.status).toBe(200);
    expect(updateStatus.data.success).toBe(true);

    const completeTask = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/complete`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(completeTask.status).toBe(200);
    expect(completeTask.data.success).toBe(true);

    const customerView = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(customerView.status).toBe(200);
    expect(customerView.data.success).toBe(true);
    expect(String(customerView.data.package?.status)).toBe("picked_up");

    const events: any[] = customerView.data.events ?? [];
    expect(events.some((e) => String(e.delivery_status) === "picked_up")).toBe(true);
  });
});

