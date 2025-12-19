// backend/src/__tests__/vehicles.test.ts
import { describe, it, expect } from "vitest";
import { apiRequest, authenticatedRequest } from "./helpers";

type LoginResponse = { user: { id: string; user_class: string }; token: string };

async function loginAsSeedDriver() {
  const { status, data } = await apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "driver_hub_0@example.com", password: "driver123" }),
  });
  expect(status).toBe(200);
  return data.token;
}

describe("Vehicles (driver)", () => {
  it("VEH-ME-401: GET /api/vehicles/me requires auth", async () => {
    const { status } = await apiRequest<any>("/api/vehicles/me");
    expect(status).toBe(401);
  });

  it("VEH-ME-001: GET /api/vehicles/me auto-creates vehicle for driver", async () => {
    const token = await loginAsSeedDriver();
    const { status, data } = await authenticatedRequest<any>("/api/vehicles/me", token);
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.vehicle?.id).toBe("string");
    expect(data.vehicle?.current_node_id).toBeTruthy();
  });

  it("VEH-MOVE-001: POST /api/vehicles/me/move updates current_node_id to adjacent node", async () => {
    const token = await loginAsSeedDriver();

    const me = await authenticatedRequest<any>("/api/vehicles/me", token);
    expect(me.status).toBe(200);
    const from = String(me.data.vehicle.current_node_id);

    const map = await apiRequest<any>("/api/map");
    expect(map.status).toBe(200);
    const edges: any[] = map.data.edges ?? [];
    const hit = edges.find((e) => String(e.source).trim() === from || String(e.target).trim() === from);
    expect(hit).toBeTruthy();
    const to = String(hit.source).trim() === from ? String(hit.target).trim() : String(hit.source).trim();

    const move = await authenticatedRequest<any>("/api/vehicles/me/move", token, {
      method: "POST",
      body: JSON.stringify({ fromNodeId: from, toNodeId: to }),
    });
    expect(move.status).toBe(200);
    expect(move.data.success).toBe(true);

    const after = await authenticatedRequest<any>("/api/vehicles/me", token);
    expect(after.status).toBe(200);
    expect(String(after.data.vehicle.current_node_id).trim()).toBe(to);
  });

  it("VEH-MOVE-409: stale fromNodeId returns conflict", async () => {
    const token = await loginAsSeedDriver();
    const me = await authenticatedRequest<any>("/api/vehicles/me", token);
    const current = String(me.data.vehicle.current_node_id);

    const res = await authenticatedRequest<any>("/api/vehicles/me/move", token, {
      method: "POST",
      body: JSON.stringify({ fromNodeId: "HUB_999999", toNodeId: current }),
    });
    expect(res.status).toBe(409);
  });
});

