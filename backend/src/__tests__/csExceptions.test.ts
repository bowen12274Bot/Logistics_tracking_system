import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestPackage,
  createTestUser,
  getCustomerServiceToken,
  getDriverToken,
  getWarehouseToken,
} from "./helpers";

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
  let warehouseToken: string;

  beforeAll(async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    customerToken = user.token;
    driverToken = await getDriverToken();
    csToken = await getCustomerServiceToken();
    warehouseToken = await getWarehouseToken();
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

  it("CS-EXC-005: redirect_destination keeps historical route prefix (no truncation)", async () => {
    const sender = "END_HOME_33";
    const receiver = "END_STORE_18";

    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const nodeIds: string[] = (mapRes.data.nodes ?? [])
      .map((n: any) => String(n?.id ?? "").trim().toUpperCase())
      .filter(Boolean);
    expect(nodeIds.includes(sender)).toBe(true);
    expect(nodeIds.includes(receiver)).toBe(true);

    const routeRes = await apiRequest<any>(
      `/api/map/route?from=${encodeURIComponent(sender)}&to=${encodeURIComponent(receiver)}`,
    );
    expect(routeRes.status).toBe(200);
    const plannedPath: string[] = (routeRes.data?.route?.path ?? []).map((v: any) => String(v).trim().toUpperCase()).filter(Boolean);
    expect(plannedPath.length).toBeGreaterThan(2);
    expect(plannedPath[0]).toBe(sender);
    expect(plannedPath[plannedPath.length - 1]).toBe(receiver);

    const pkg = await createTestPackage(customerToken, {
      sender_address: sender,
      receiver_address: receiver,
      route_path: JSON.stringify(plannedPath),
    });

    const statusBefore = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusBefore.status).toBe(200);
    const rawRoute = String(statusBefore.data.package?.route_path ?? "").trim();
    const oldPath: string[] = rawRoute.startsWith("[")
      ? (JSON.parse(rawRoute) as any[]).map((v) => String(v).trim().toUpperCase()).filter(Boolean)
      : rawRoute.split(",").map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    expect(oldPath).toEqual(plannedPath);

    const mid = oldPath.find((n) => n === "REG_14") ?? oldPath.find((n) => /^REG_/i.test(n)) ?? oldPath[1];
    expect(mid).toBeTruthy();
    expect(mid).not.toBe(sender);
    expect(mid).not.toBe(receiver);

    // Find which hub driver got the pickup task.
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

    await walkVehicleTo(String(pickupDriverToken), sender);
    const pickup = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/pickup`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(pickup.status).toBe(200);

    await walkVehicleTo(String(pickupDriverToken), String(mid));
    const me = await authenticatedRequest<any>("/api/vehicles/me", String(pickupDriverToken));
    expect(me.status).toBe(200);
    const truckCode = String(me.data.vehicle.vehicle_code ?? "").trim();
    expect(truckCode).toMatch(/^TRUCK_/i);

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "address_issue", description: "route check", location: truckCode }) },
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
          destination_override: receiver,
          handling_report: "resume without truncation",
        }),
      },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    const statusAfter = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusAfter.status).toBe(200);
    const afterRaw = String(statusAfter.data.package?.route_path ?? "").trim();
    const newPath: string[] = afterRaw.startsWith("[")
      ? (JSON.parse(afterRaw) as any[]).map((v) => String(v).trim().toUpperCase()).filter(Boolean)
      : afterRaw.split(",").map((v) => String(v).trim().toUpperCase()).filter(Boolean);

    expect(newPath[0]).toBe(sender);
    expect(newPath[newPath.length - 1]).toBe(receiver);
    const idxOld = oldPath.indexOf(mid);
    const idxNew = newPath.indexOf(mid);
    expect(idxOld).toBeGreaterThan(0);
    expect(idxNew).toBe(idxOld);
    expect(newPath.slice(0, idxNew + 1)).toEqual(oldPath.slice(0, idxOld + 1));
  });

  it("CS-EXC-006: redirect_destination from repeated node keeps latest occurrence prefix", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";

    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const edges: any[] = mapRes.data.edges ?? [];

    const routeRes = await apiRequest<any>(
      `/api/map/route?from=${encodeURIComponent(sender)}&to=${encodeURIComponent(receiver)}`,
    );
    expect(routeRes.status).toBe(200);
    const planned: string[] = (routeRes.data?.route?.path ?? []).map((v: any) => String(v).trim().toUpperCase()).filter(Boolean);
    expect(planned.length).toBeGreaterThan(2);
    const regA = planned[1];
    expect(String(regA)).toMatch(/^(REG_|HUB_)/i);

    const hubNeighbor = edges.flatMap((e: any) => {
      const a = String(e.source ?? "").trim().toUpperCase();
      const b = String(e.target ?? "").trim().toUpperCase();
      if (a === regA && /^HUB_/i.test(b)) return [b];
      if (b === regA && /^HUB_/i.test(a)) return [a];
      return [];
    })[0] ?? null;
    expect(String(hubNeighbor ?? "")).toMatch(/^HUB_/i);

    const looped = [planned[0], regA, String(hubNeighbor), regA, ...planned.slice(2)];

    const pkg = await createTestPackage(customerToken, {
      sender_address: sender,
      receiver_address: receiver,
      route_path: JSON.stringify(looped),
    });

    // Find which hub driver got the pickup task.
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

    await walkVehicleTo(String(pickupDriverToken), sender);
    const pickup = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/pickup`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(pickup.status).toBe(200);

    // Walk to HUB neighbor then back to the same REG node (second occurrence in route_path).
    await walkVehicleTo(String(pickupDriverToken), String(hubNeighbor));
    await walkVehicleTo(String(pickupDriverToken), String(regA));

    const me = await authenticatedRequest<any>("/api/vehicles/me", String(pickupDriverToken));
    expect(me.status).toBe(200);
    const truckCode = String(me.data.vehicle.vehicle_code ?? "").trim();
    expect(truckCode).toMatch(/^TRUCK_/i);

    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "address_issue", description: "repeat node", location: truckCode }) },
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
          destination_override: receiver,
          handling_report: "resume at repeated node",
        }),
      },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    const statusAfter = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusAfter.status).toBe(200);
    const afterRaw = String(statusAfter.data.package?.route_path ?? "").trim();
    expect(afterRaw.startsWith("[")).toBe(true);
    const newPath: string[] = (JSON.parse(afterRaw) as any[]).map((v) => String(v).trim().toUpperCase()).filter(Boolean);

    const idxSecond = looped.lastIndexOf(regA);
    expect(idxSecond).toBeGreaterThan(1);
    expect(newPath.slice(0, idxSecond + 1)).toEqual(looped.slice(0, idxSecond + 1));
  });

  it("CS-EXC-HANDLE-002: handle exception with action=cancel", async () => {
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

    // Driver reports exception
    const report = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg.id)}/exception`,
      String(pickupDriverToken),
      { method: "POST", body: JSON.stringify({ reason_code: "lost", description: "lost" }) },
    );
    expect(report.status).toBe(200);
    const exceptionId = String(report.data.exception_id ?? "");
    expect(exceptionId).toBeTruthy();

    // CS cancels
    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exceptionId)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "cancel", cancel_reason: "destroy", handling_report: "lost package", location: "HUB_0" }) },
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

  it("CS-EXC-WH-001: resume warehouse exception before receive restores warehouse_in (no driver task)", async () => {
    const pkg = await createTestPackage(customerToken, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });

    // Simulate package arrived at HUB_0 but not yet received by warehouse staff.
    const evt = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, warehouseToken, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "warehouse_in", location: "HUB_0" }),
    });
    expect(evt.status).toBe(200);

    // Warehouse reports exception before receive.
    const report = await authenticatedRequest<any>(
      `/api/warehouse/packages/${encodeURIComponent(pkg.id)}/exception`,
      warehouseToken,
      { method: "POST", body: JSON.stringify({ reason_code: "lost", description: "站內找不到包裹" }) },
    );
    expect(report.status).toBe(200);
    expect(report.data.success).toBe(true);

    // CS finds the exception and resumes it.
    const list = await authenticatedRequest<any>("/api/cs/exceptions", csToken);
    expect(list.status).toBe(200);
    const items: any[] = list.data.exceptions ?? [];
    const hit = items.find((e) => String(e.package_id) === pkg.id && String(e.reported_role) === "warehouse_staff");
    expect(hit).toBeTruthy();

    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(String(hit.id))}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "resume", resume_mode: "continue_segment", handling_report: "已排除", location: "HUB_0" }) },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    // After resume, it should stay in warehouse workflow (await_receive), not jump to driver delivery task pool.
    const whList = await authenticatedRequest<any>("/api/warehouse/packages?limit=200", warehouseToken, { method: "GET" });
    expect(whList.status).toBe(200);
    const whPkg = (whList.data.packages ?? []).find((p: any) => String(p.id) === pkg.id);
    expect(whPkg).toBeTruthy();
    expect(String(whPkg.latest_event?.delivery_status ?? "").trim().toLowerCase()).toBe("warehouse_in");
    expect(String(whPkg.ui_state ?? "")).toBe("await_receive");

    const drvAssigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", driverToken);
    expect(drvAssigned.status).toBe(200);
    expect((drvAssigned.data.tasks ?? []).some((t: any) => String(t.package_id) === pkg.id)).toBe(false);
  });

  it("CS-EXC-WH-002: redirect_destination updates receiver even when staying in warehouse workflow", async () => {
    const sender = "END_HOME_1";
    const receiver = "END_HOME_2";
    const pkg = await createTestPackage(customerToken, { sender_address: sender, receiver_address: receiver });

    const mapRes = await apiRequest<any>("/api/map");
    expect(mapRes.status).toBe(200);
    const dest = (mapRes.data.nodes ?? [])
      .map((n: any) => String(n?.id ?? "").trim().toUpperCase())
      .find((id: string) => /^END_/i.test(id) && id !== sender && id !== receiver);
    expect(dest).toBeTruthy();

    const evt = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, warehouseToken, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "warehouse_in", location: "HUB_0" }),
    });
    expect(evt.status).toBe(200);

    const report = await authenticatedRequest<any>(
      `/api/warehouse/packages/${encodeURIComponent(pkg.id)}/exception`,
      warehouseToken,
      { method: "POST", body: JSON.stringify({ reason_code: "address_issue", description: "wrong address" }) },
    );
    expect(report.status).toBe(200);
    expect(report.data.success).toBe(true);

    const list = await authenticatedRequest<any>("/api/cs/exceptions", csToken);
    expect(list.status).toBe(200);
    const items: any[] = list.data.exceptions ?? [];
    const hit = items.find((e) => String(e.package_id) === pkg.id && String(e.reported_role) === "warehouse_staff");
    expect(hit).toBeTruthy();

    const handle = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(String(hit.id))}/handle`,
      csToken,
      {
        method: "POST",
        body: JSON.stringify({
          action: "resume",
          resume_mode: "redirect_destination",
          destination_override: dest,
          handling_report: "redirect destination",
          location: "HUB_0",
        }),
      },
    );
    expect(handle.status).toBe(200);
    expect(handle.data.success).toBe(true);

    const statusRes = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(statusRes.status).toBe(200);
    expect(String(statusRes.data.package?.receiver_address)).toBe(dest);

    const drvAssigned = await authenticatedRequest<any>("/api/driver/tasks?scope=assigned", driverToken);
    expect(drvAssigned.status).toBe(200);
    expect((drvAssigned.data.tasks ?? []).some((t: any) => String(t.package_id) === pkg.id)).toBe(false);
  });

  it("CS-EXC-LIST-002: filter by handled status", async () => {
    // Setup: Create two exceptions, one handled, one unhandled
    
    // 1. Create Handled Exception
    const pkg1 = await createTestPackage(customerToken, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });
    const rep1 = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg1.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ reason_code: "damaged", description: "handled issue" }) },
    );
    expect(rep1.status, JSON.stringify(rep1.data)).toBe(200);
    const exc1Id = String(rep1.data.exception_id ?? "");
    expect(exc1Id).toBeTruthy();
    const handle1 = await authenticatedRequest<any>(
      `/api/cs/exceptions/${encodeURIComponent(exc1Id)}/handle`,
      csToken,
      { method: "POST", body: JSON.stringify({ action: "resume", handling_report: "fixed", location: "HUB_0" }) },
    );
    expect(handle1.status, JSON.stringify(handle1.data)).toBe(200);

    // 2. Create Unhandled Exception
    const pkg2 = await createTestPackage(customerToken, { sender_address: "END_HOME_1", receiver_address: "END_HOME_2" });
    const rep2 = await authenticatedRequest<any>(
      `/api/driver/packages/${encodeURIComponent(pkg2.id)}/exception`,
      driverToken,
      { method: "POST", body: JSON.stringify({ reason_code: "damaged", description: "unhandled issue" }) },
    );
    expect(rep2.status, JSON.stringify(rep2.data)).toBe(200);
    const exc2Id = String(rep2.data.exception_id ?? "");
    expect(exc2Id).toBeTruthy();

    // Filter handled=true
    const handledRes = await authenticatedRequest<any>("/api/cs/exceptions?handled=true", csToken);
    expect(handledRes.status, JSON.stringify(handledRes.data)).toBe(200);
    const handledList: any[] = handledRes.data.exceptions ?? [];
    expect(handledList.length).toBeGreaterThan(0);
    expect(handledList.find(e => e.id === exc1Id)).toBeTruthy();
    expect(handledList.find(e => e.id === exc2Id)).toBeFalsy();
    expect(handledList.every(e => e.handled === 1)).toBe(true);

    // Filter handled=false
    const unhandledRes = await authenticatedRequest<any>("/api/cs/exceptions?handled=false", csToken);
    expect(unhandledRes.status, JSON.stringify(unhandledRes.data)).toBe(200);
    const unhandledList: any[] = unhandledRes.data.exceptions ?? [];
    expect(unhandledList.find(e => e.id === exc2Id)).toBeTruthy();
    expect(unhandledList.find(e => e.id === exc1Id)).toBeFalsy();
    expect(unhandledList.every(e => e.handled === 0)).toBe(true);
  });
});
