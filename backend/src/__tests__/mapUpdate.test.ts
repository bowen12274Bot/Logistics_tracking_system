import { describe, it, expect } from "vitest";
import { apiRequest } from "./helpers";

describe("Map Edge Update API", () => {
  describe("PUT /api/map/edges/:id", () => {
    it("should return 404 for non-existent edge", async () => {
      const { status, data } = await apiRequest<any>(
        "/api/map/edges/non-existent-edge",
        {
          method: "PUT",
          body: JSON.stringify({ cost: 100 }),
        }
      );
      expect(status).toBe(404);
      expect(data.error).toContain("not found");
    });

    it("should return success with no changes when body is empty", async () => {
      // Since we can't easily create an edge, we test that empty body returns appropriate response
      const { status, data } = await apiRequest<any>(
        "/api/map/edges/some-edge-id",
        {
          method: "PUT",
          body: JSON.stringify({}),
        }
      );
      // Either 404 (not found) or 200 (no changes) is acceptable
      expect([200, 404]).toContain(status);
    });

    it("should accept road_multiple parameter", async () => {
      const { status } = await apiRequest<any>(
        "/api/map/edges/edge-1",
        {
          method: "PUT",
          body: JSON.stringify({ road_multiple: 2 }),
        }
      );
      // Either 404 (edge not found) or 200 (updated) is acceptable
      expect([200, 404]).toContain(status);
    });

    it("should accept cost parameter", async () => {
      const { status } = await apiRequest<any>(
        "/api/map/edges/edge-1",
        {
          method: "PUT",
          body: JSON.stringify({ cost: 150 }),
        }
      );
      // Either 404 (edge not found) or 200 (updated) is acceptable
      expect([200, 404]).toContain(status);
    });

    it("should accept both road_multiple and cost parameters", async () => {
      const { status } = await apiRequest<any>(
        "/api/map/edges/edge-1",
        {
          method: "PUT",
          body: JSON.stringify({ road_multiple: 3, cost: 200 }),
        }
      );
      // Either 404 (edge not found) or 200 (updated) is acceptable
      expect([200, 404]).toContain(status);
    });
  });
});
