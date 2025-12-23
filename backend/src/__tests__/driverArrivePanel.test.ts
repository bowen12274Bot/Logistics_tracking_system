import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestPackage, createTestUser, getDriverToken } from "./helpers";

describe("Driver Arrive Panel APIs", () => {
  let customerToken: string;
  let driverToken: string;

  beforeAll(async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    customerToken = user.token;
    driverToken = await getDriverToken();
  });

  it("DRV-EXC-001: driver can report package exception and package status becomes exception", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";
    const pkg = await createTestPackage(customerToken, { sender_address: sender, receiver_address: receiver });

    // Find which hub driver got the pickup task.
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

    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assignedRes = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assignedRes.status).toBe(200);
      const hit = (assignedRes.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickupDriverToken).toBeTruthy();

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "damaged", description: "box damaged", location: sender }) },
    );
    expect(report.status).toBe(200);
    expect(report.data.success).toBe(true);

    // Since this exception happens before pickup starts, the pending/accepted task should be canceled
    // and not appear in the assigned active list.
    const assignedAfter = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", String(pickupDriverToken));
    expect(assignedAfter.status).toBe(200);
    expect((assignedAfter.data.tasks ?? []).some((t: any) => t.package_id === pkg.id)).toBe(false);

    const statusRes = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusRes.status).toBe(200);
    expect(statusRes.data.success).toBe(true);
    expect(String(statusRes.data.package?.status)).toBe("exception");
    const events: any[] = statusRes.data.events ?? [];
    expect(events.some((e) => String(e.delivery_status) === "exception")).toBe(true);
  });
});
