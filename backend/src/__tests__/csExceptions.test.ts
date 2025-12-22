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

  it("CS-EXC-HANDLE-002: handle exception with action=cancel", async () => {
    const pkg = await createTestPackage(customerToken);
    
    // Driver reports exception
    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ description: "lost", location: "TRUCK_0" }) },
    );
    const exceptionId = report.data.exception_id;

    // CS cancels
    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "cancel", handling_report: "lost package", location: "HUB_0" }) },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    // Check package status -> delivery_failed
    const statusRes = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(String(statusRes.data.package?.status)).toBe("delivery_failed");
  });

  it("CS-EXC-HANDLE-003: missing handling_report returns 400", async () => {
    const pkg = await createTestPackage(customerToken);
    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ description: "issue", location: "TRUCK_0" }) },
    );
    const exceptionId = report.data.exception_id;

    const res = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "resume", location: "HUB_0" }) } // missing handling_report
    );
    expect(res.status).toBe(400);
  });

  it("CS-EXC-LIST-002: filter by handled status", async () => {
    // Setup: Create two exceptions, one handled, one unhandled
    
    // 1. Create Handled Exception
    const pkg1 = await createTestPackage(customerToken);
    const rep1 = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg1.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ description: "handled issue", location: "TRUCK_0" }) },
    );
    const exc1Id = rep1.data.exception_id;
    await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exc1Id)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "resume", handling_report: "fixed", location: "HUB_0" }) },
    );

    // 2. Create Unhandled Exception
    const pkg2 = await createTestPackage(customerToken);
    const rep2 = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg2.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ description: "unhandled issue", location: "TRUCK_0" }) },
    );
    const exc2Id = rep2.data.exception_id;

    // Filter handled=true
    const handledRes = await authenticatedRequest<any>("/api/cs/exceptions?handled=true", csToken);
    expect(handledRes.status).toBe(200);
    const handledList: any[] = handledRes.data.exceptions ?? [];
    expect(handledList.length).toBeGreaterThan(0);
    expect(handledList.find(e => e.id === exc1Id)).toBeTruthy();
    expect(handledList.find(e => e.id === exc2Id)).toBeFalsy();
    expect(handledList.every(e => e.handled === 1)).toBe(true);

    // Filter handled=false
    const unhandledRes = await authenticatedRequest<any>("/api/cs/exceptions?handled=false", csToken);
    expect(unhandledRes.status).toBe(200);
    const unhandledList: any[] = unhandledRes.data.exceptions ?? [];
    expect(unhandledList.find(e => e.id === exc2Id)).toBeTruthy();
    expect(unhandledList.find(e => e.id === exc1Id)).toBeFalsy();
    expect(unhandledList.every(e => e.handled === 0)).toBe(true);
  });
});

