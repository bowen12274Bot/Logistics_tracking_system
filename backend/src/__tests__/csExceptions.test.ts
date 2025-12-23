import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestPackage, createTestUser, getCustomerServiceToken, getDriverToken } from "./helpers";

async function loginDriver(hubId: string) {
  const { status, data } = await apiRequest<{ token: string }>(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ identifier: `driver_${hubId.toLowerCase()}@example.com`, password: "driver123" }),
  });
  expect(status).toBe(200);
  return data.token;
}

async function walkVehicleTo(driverToken: string, toNodeId: string) {
  const me = await authenticatedRequest<any>("/api/vehicles/me", driverToken);
  expect(me.status).toBe(200);
  let current = String(me.data.vehicle.current_node_id ?? me.data.vehicle.home_node_id ?? "");
  expect(current).toBeTruthy();

  const routeRes = await apiRequest<any>(`/api/map/route?from=${encodeURIComponent(current)}&to=${encodeURIComponent(toNodeId)}`);
  expect(routeRes.status).toBe(200);
  const path: string[] = routeRes.data?.route?.path ?? [];
  expect(path[0]).toBe(current);
  expect(path[path.length - 1]).toBe(toNodeId);

  for (let i = 0; i < path.length - 1; i++) {
    const from = String(path[i]);
    const to = String(path[i + 1]);
    const move = await authenticatedRequest<any>("/api/vehicles/me/move", driverToken, {
      method: "POST",
      body: JSON.stringify({ fromNodeId: from, toNodeId: to }),
    });
    expect(move.status).toBe(200);
    current = to;
  }
}

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

    // Find which hub driver got the pickup task.
    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const hubs: string[] = (mapRes.data.nodes ?? [])
      .filter((n: any) => Number(n.level) === 1 && typeof n.id === "string")
      .map((n: any) => String(n.id));
    expect(hubs.length).toBeGreaterThan(0);

    let pickupTask: any | null = null;
    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assigned.status).toBe(200);
      const hit = (assigned.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickupTask = hit;
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickupTask).toBeTruthy();
    expect(pickupDriverToken).toBeTruthy();

    await walkVehicleTo(String(pickupDriverToken), String(pickupTask.from_location ?? "END_HOME_1"));

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "damaged", description: "box damaged" }) },
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
      { method: "POST", body: JSON.stringify({ action: "resume", resume_mode: "continue_segment", handling_report: "ok", location: "HUB_0" }) },
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

    // Resume should recreate a pending task for drivers to continue delivery.
    const tasks = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", String(pickupDriverToken));
    expect(tasks.status).toBe(200);
    expect((tasks.data.tasks ?? []).some((t: any) => t.package_id === pkg.id)).toBe(true);
  });

  it("CS-EXC-002: cancel writes delivery_failed and customer payload hides exception description", async () => {
    const pkg = await createTestPackage(customerToken, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });

    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const hubs: string[] = (mapRes.data.nodes ?? [])
      .filter((n: any) => Number(n.level) === 1 && typeof n.id === "string")
      .map((n: any) => String(n.id));
    expect(hubs.length).toBeGreaterThan(0);

    let pickupTask: any | null = null;
    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assigned.status).toBe(200);
      const hit = (assigned.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickupTask = hit;
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickupTask).toBeTruthy();
    expect(pickupDriverToken).toBeTruthy();

    await walkVehicleTo(String(pickupDriverToken), String(pickupTask.from_location ?? "END_HOME_1"));

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "refused", description: "customer refused" }) },
    );
    expect(report.status).toBe(200);
    const exceptionId = String(report.data.exception_id ?? "");
    expect(exceptionId).toBeTruthy();

    const customerStatusBefore = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(customerStatusBefore.status).toBe(200);
    expect(customerStatusBefore.data.success).toBe(true);
    expect(String(customerStatusBefore.data.package?.status)).toBe("exception");
    expect(customerStatusBefore.data.active_exception?.reason_code).toBe("refused");
    expect(customerStatusBefore.data.active_exception?.description ?? null).toBeNull();
    const eventsBefore: any[] = customerStatusBefore.data.events ?? [];
    const exceptionEvent = eventsBefore.find((e) => String(e.delivery_status) === "exception");
    expect(exceptionEvent).toBeTruthy();
    expect(exceptionEvent.delivery_details ?? null).toBeNull();

    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "cancel", cancel_reason: "destroy", handling_report: "cancel it", location: "HUB_0" }) },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);
    expect(String(handle.data.action)).toBe("cancel");
    expect(String(handle.data.delivery_failed_event_id ?? "")).toBeTruthy();

    const customerStatusAfter = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(customerStatusAfter.status).toBe(200);
    expect(String(customerStatusAfter.data.package?.status)).toBe("delivery_failed");
    const eventsAfter: any[] = customerStatusAfter.data.events ?? [];
    expect(eventsAfter.some((e) => String(e.delivery_status) === "delivery_failed")).toBe(true);

    // Once delivery_failed, further operational writes should be blocked.
    const badWrite = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/status`,
      driverToken,
      { method: "POST", body: JSON.stringify({ status: "in_transit", note: "try move", location: "TRUCK_0" }) },
    );
    expect(badWrite.status).toBe(409);
  });

  it("CS-EXC-003: resume while cargo is on truck reissues last segment so driver can dropoff (no skipping)", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";
    const pkg = await createTestPackage(customerToken, { sender_address: sender, receiver_address: receiver });

    // Find the pickup task and which hub driver it belongs to.
    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const hubs: string[] = (mapRes.data.nodes ?? [])
      .filter((n: any) => Number(n.level) === 1 && typeof n.id === "string")
      .map((n: any) => String(n.id));
    expect(hubs.length).toBeGreaterThan(0);

    let pickupTask: any | null = null;
    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assigned.status).toBe(200);
      const hit = (assigned.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickupTask = hit;
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickupTask).toBeTruthy();
    expect(pickupDriverToken).toBeTruthy();

    const regNode = String(pickupTask.to_location ?? "");
    expect(/^REG_\d+$/i.test(regNode)).toBe(true);

    await walkVehicleTo(String(pickupDriverToken), sender);
    const pickup = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/pickup`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(pickup.status).toBe(200);

    // Arrive at REG but do NOT dropoff yet (cargo still on truck).
    await walkVehicleTo(String(pickupDriverToken), regNode);
    const me = await authenticatedRequest<any>("/api/vehicles/me", String(pickupDriverToken));
    expect(me.status).toBe(200);
    const truckCode = String(me.data.vehicle.vehicle_code ?? "").trim();
    expect(truckCode).toMatch(/^TRUCK_/i);

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "damaged", description: "box damaged", location: truckCode }) },
    );
    expect(report.status).toBe(200);
    const exceptionId = String(report.data.exception_id ?? "");
    expect(exceptionId).toBeTruthy();

    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "resume", resume_mode: "continue_segment", handling_report: "ok" }) },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    const assignedAfter = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", String(pickupDriverToken));
    expect(assignedAfter.status).toBe(200);
    const resumed = (assignedAfter.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
    expect(resumed).toBeTruthy();
    expect(String(resumed.status)).toBe("in_progress");
    expect(String(resumed.to_location)).toBe(regNode);

    // Driver can dropoff (unload) at REG after resume.
    const dropoff = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(resumed.id))}/dropoff`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(dropoff.status).toBe(200);
    expect(dropoff.data.success).toBe(true);
    expect(String(dropoff.data.status)).toBe("warehouse_in");
  });

  it("CS-EXC-004: return_to_origin resumes by redirecting destination to sender (no unload required)", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";
    const pkg = await createTestPackage(customerToken, { sender_address: sender, receiver_address: receiver });

    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const hubs: string[] = (mapRes.data.nodes ?? [])
      .filter((n: any) => Number(n.level) === 1 && typeof n.id === "string")
      .map((n: any) => String(n.id));
    expect(hubs.length).toBeGreaterThan(0);

    let pickupTask: any | null = null;
    let pickupDriverToken: string | null = null;
    for (const hubId of hubs) {
      const token = hubId === "HUB_0" ? driverToken : await loginDriver(hubId);
      const assigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", token);
      expect(assigned.status).toBe(200);
      const hit = (assigned.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
      if (hit) {
        pickupTask = hit;
        pickupDriverToken = token;
        break;
      }
    }
    expect(pickupTask).toBeTruthy();
    expect(pickupDriverToken).toBeTruthy();

    const regNode = String(pickupTask.to_location ?? "");
    expect(regNode).toBeTruthy();

    await walkVehicleTo(String(pickupDriverToken), sender);
    const pickup = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/pickup`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(pickup.status).toBe(200);

    await walkVehicleTo(String(pickupDriverToken), regNode);
    const me = await authenticatedRequest<any>("/api/vehicles/me", String(pickupDriverToken));
    expect(me.status).toBe(200);
    const truckCode = String(me.data.vehicle.vehicle_code ?? "").trim();
    expect(truckCode).toMatch(/^TRUCK_/i);

    // Driver provides a node location, but backend should lock the event location to TRUCK_* while cargo is loaded.
    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "refused", description: "return", location: truckCode }) },
    );
    expect(report.status).toBe(200);
    const exceptionId = String(report.data.exception_id ?? "");
    expect(exceptionId).toBeTruthy();

    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      {
        method: "POST",
        body: JSON.stringify({
          action: "resume",
          resume_mode: "redirect_destination",
          handling_report: "return to origin",
        }),
      },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    const statusRes = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusRes.status).toBe(200);
    expect(String(statusRes.data.package?.receiver_address)).toBe(sender);

    const assignedAfter = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", String(pickupDriverToken));
    expect(assignedAfter.status).toBe(200);
    const resumed = (assignedAfter.data.tasks ?? []).find((t: any) => t.package_id === pkg.id);
    expect(resumed).toBeTruthy();
    expect(String(resumed.status)).toBe("in_progress");
    expect(String(resumed.from_location)).toBe(regNode);
    expect(String(resumed.to_location)).not.toBe(regNode);
  });
});
