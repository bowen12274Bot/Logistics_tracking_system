import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestPackage, createTestUser, getDriverToken } from "./helpers";

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

describe("Cargo flow: pickup -> dropoff at REG", () => {
  let customerToken: string;
  let driverHub0Token: string;

  beforeAll(async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    customerToken = user.token;
    driverHub0Token = await getDriverToken();
  });

  it("CARGO-001: after pickup then dropoff at REG, customer sees warehouse_in event", async () => {
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
      const token = hubId === "HUB_0" ? driverHub0Token : await loginDriver(hubId);
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
    expect(String(pickupTask.from_location)).toBe(sender);
    const regNode = String(pickupTask.to_location ?? "");
    expect(/^REG_\d+$/i.test(regNode)).toBe(true);

    // Driver goes to sender node, pickups (loads cargo + picked_up event)
    await walkVehicleTo(String(pickupDriverToken), sender);
    const pickup = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/pickup`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(pickup.status).toBe(200);
    expect(pickup.data.success).toBe(true);

    // Cargo should be on truck now
    const cargo = await authenticatedRequest<any>("/api/vehicles/me/cargo", String(pickupDriverToken));
    expect(cargo.status).toBe(200);
    const items: any[] = cargo.data.cargo ?? [];
    expect(items.some((c) => c.package_id === pkg.id)).toBe(true);

    // Driver goes to REG and drops off (unload + warehouse_in event)
    await walkVehicleTo(String(pickupDriverToken), regNode);
    const dropoff = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/dropoff`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(dropoff.status).toBe(200);
    expect(dropoff.data.success).toBe(true);
    expect(String(dropoff.data.status)).toBe("warehouse_in");

    const customerView = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(customerView.status).toBe(200);
    expect(customerView.data.success).toBe(true);
    expect(String(customerView.data.package?.status)).toBe("warehouse_in");
    const events: any[] = customerView.data.events ?? [];
    expect(events.some((e) => String(e.delivery_status) === "picked_up")).toBe(true);
    expect(events.some((e) => String(e.delivery_status) === "warehouse_in")).toBe(true);
  });

  it("CARGO-002: dropoff without pickup is rejected", async () => {
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
      const token = hubId === "HUB_0" ? driverHub0Token : await loginDriver(hubId);
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

    // Go directly to REG without pickup
    await walkVehicleTo(String(pickupDriverToken), regNode);

    const dropoff = await authenticatedRequest<any>(
      `/api/driver/tasks/${encodeURIComponent(String(pickupTask.id))}/dropoff`,
      String(pickupDriverToken),
      { method: "POST" },
    );
    expect(dropoff.status).toBe(409);

    const cargo = await authenticatedRequest<any>("/api/vehicles/me/cargo", String(pickupDriverToken));
    expect(cargo.status).toBe(200);
    const items: any[] = cargo.data.cargo ?? [];
    expect(items.some((c) => c.package_id === pkg.id)).toBe(false);
  });

  it("CARGO-003: after pickup and moving, customer sees in_transit at truck location", async () => {
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
      const token = hubId === "HUB_0" ? driverHub0Token : await loginDriver(hubId);
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

    // Move to REG but do not dropoff yet
    await walkVehicleTo(String(pickupDriverToken), regNode);

    const customerView = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/status`, customerToken);
    expect(customerView.status).toBe(200);
    expect(customerView.data.success).toBe(true);
    expect(String(customerView.data.package?.status)).toBe("in_transit");
    expect(String(customerView.data.vehicle?.vehicle_code ?? "")).toMatch(/^TRUCK_/i);

    const events: any[] = customerView.data.events ?? [];
    const latest = events.length ? events[events.length - 1] : null;
    expect(latest).toBeTruthy();
    expect(String(latest.delivery_status)).toBe("in_transit");
    expect(String(latest.location)).toBe(String(customerView.data.vehicle.vehicle_code));
  });
});
