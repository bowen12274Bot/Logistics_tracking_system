import { describe, it, expect, beforeAll } from "vitest";
import { authenticatedRequest, createTestPackage, createTestUser, getCustomerServiceToken, getDriverToken } from "./helpers";

describe("Customer service exception pool", () => {
  let customerToken: string;
  let driverToken: string;
  let csToken: string;

  beforeAll(async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    customerToken = user.token;
    driverToken = await getDriverToken();
    csToken = await getCustomerServiceToken();
  });

  it("CS-EXC-001: driver reports exception -> CS can list and handle it (resume)", async () => {
    const pkg = await createTestPackage(customerToken, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ description: "damaged", location: "TRUCK_0" }) },
    );
    expect(report.status).toBe(200);
    expect(report.data.success).toBe(true);
    const exceptionId = String(report.data.exception_id ?? "");
    expect(exceptionId).toBeTruthy();

    const list = await authenticatedRequest<any>("/api/cs/exceptions", csToken);
    expect(list.status).toBe(200);
    expect(list.data.success).toBe(true);
    const items: any[] = list.data.exceptions ?? [];
    expect(items.some((e) => String(e.id) === exceptionId)).toBe(true);

    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "resume", handling_report: "ok", location: "HUB_0" }) },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    const statusRes = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusRes.status).toBe(200);
    expect(statusRes.data.success).toBe(true);
    expect(String(statusRes.data.package?.status)).toBe("warehouse_in");
    const events: any[] = statusRes.data.events ?? [];
    expect(events.some((e) => String(e.delivery_status) === "exception")).toBe(true);
    expect(events.some((e) => String(e.delivery_status) === "exception_resolved")).toBe(true);
  });
});

