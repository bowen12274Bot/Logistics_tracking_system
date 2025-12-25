import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestUser, createTestPackage, getAdminToken } from "./helpers";

describe("Tracking", () => {
  let customerToken: string;
  let adminToken: string;
  let testPackage: any;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const user = await createTestUser();
    customerToken = user.token;
    testPackage = await createTestPackage(customerToken);
  });

  describe("GET /api/tracking/:trackingNumber", () => {
    it("TRACK-PUB-001: valid tracking number", async () => {
      const { status, data } = await apiRequest<any>(`/api/tracking/${testPackage.tracking_number}`);
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tracking_number).toBe(testPackage.tracking_number);
    });

    it("TRACK-PUB-002: invalid tracking number", async () => {
      const { status } = await apiRequest<any>("/api/tracking/INVALID12345");
      expect(status).toBe(404);
    });

    it("TRACK-PUB-003: events array exists", async () => {
      const { status, data } = await apiRequest<any>(`/api/tracking/${testPackage.tracking_number}`);
      expect(status).toBe(200);
      expect(Array.isArray(data.events)).toBe(true);
    });
  });

  describe("POST /api/packages/:packageId/events (employee-only)", () => {
    it("TRACK-EVT-007: package not found", async () => {
      const { status } = await authenticatedRequest<any>("/api/packages/non-existent/events", adminToken, {
        method: "POST",
        body: JSON.stringify({ delivery_status: "picked_up" }),
      });
      expect(status).toBe(404);
    });

    it("TRACK-EVT-010: create event ok", async () => {
      const pkg = await createTestPackage(customerToken);
      const { status, data } = await authenticatedRequest<any>(`/api/packages/${encodeURIComponent(pkg.id)}/events`, adminToken, {
        method: "POST",
        body: JSON.stringify({ delivery_status: "picked_up", delivery_details: "picked" }),
      });
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/tracking/search", () => {
    it("TRACK-SEARCH-007: customer can search own packages", async () => {
      const pkg = await createTestPackage(customerToken);
      const { status, data } = await authenticatedRequest<any>(
        `/api/tracking/search?tracking_number=${encodeURIComponent(pkg.tracking_number)}`,
        customerToken,
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect((data.packages ?? []).some((p: any) => p.id === pkg.id)).toBe(true);
    });
  });
});

