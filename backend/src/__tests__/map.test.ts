// backend/src/__tests__/map.test.ts
// 地圖路線測試 (Map)

import { describe, it, expect } from "vitest";
import { apiRequest, authenticatedRequest, createTestUser } from "./helpers";

describe("地圖路線 (Map)", () => {
  // ========== GET /api/map ==========
  describe("GET /api/map - 取得地圖", () => {
    it("MAP-GET-001: 成功取得地圖資料", async () => {
      const { status, data } = await apiRequest<any>("/api/map");

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("MAP-GET-002: nodes 為陣列", async () => {
      const { status, data } = await apiRequest<any>("/api/map");

      expect(status).toBe(200);
      expect(Array.isArray(data.nodes)).toBe(true);
    });

    it("MAP-GET-003: edges 為陣列", async () => {
      const { status, data } = await apiRequest<any>("/api/map");

      expect(status).toBe(200);
      expect(Array.isArray(data.edges)).toBe(true);
    });

    it("MAP-GET-004: node 結構完整", async () => {
      const { status, data } = await apiRequest<any>("/api/map");

      expect(status).toBe(200);
      if (data.nodes.length > 0) {
        const node = data.nodes[0];
        expect(node.id).toBeDefined();
        expect(node.name).toBeDefined();
        expect(typeof node.x).toBe("number");
        expect(typeof node.y).toBe("number");
      }
    });

    it("MAP-GET-005: edge 結構完整", async () => {
      const { status, data } = await apiRequest<any>("/api/map");

      expect(status).toBe(200);
      if (data.edges.length > 0) {
        const edge = data.edges[0];
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
        expect(typeof edge.cost).toBe("number");
      }
    });

    it("MAP-GET-006: 不需認證", async () => {
      const { status } = await apiRequest<any>("/api/map");
      expect(status).toBe(200);
    });
  });

  // ========== GET /api/map/route ==========
  describe("GET /api/map/route - 路線成本計算", () => {
    let validNodes: { source: string; target: string };

    it("MAP-ROUTE-002: 缺少 from 參數", async () => {
      const { status } = await apiRequest<any>("/api/map/route?to=END_1");
      expect(status).toBe(400);
    });

    it("MAP-ROUTE-003: 缺少 to 參數", async () => {
      const { status } = await apiRequest<any>("/api/map/route?from=HUB_1");
      expect(status).toBe(400);
    });

    it("MAP-ROUTE-004: 無效的起點節點", async () => {
      const { status, data } = await apiRequest<any>(
        "/api/map/route?from=INVALID&to=END_1"
      );
      expect(status).toBe(404);
    });

    it("MAP-ROUTE-005: 無效的終點節點", async () => {
      // 先取得有效的節點
      const mapData = await apiRequest<any>("/api/map");
      if (mapData.data.nodes.length > 0) {
        const validFrom = mapData.data.nodes[0].id;
        const { status } = await apiRequest<any>(
          `/api/map/route?from=${validFrom}&to=INVALID`
        );
        expect(status).toBe(404);
      }
    });

    it("MAP-ROUTE-001: 計算兩點路線成本", async () => {
      // 先取得有效的節點
      const mapData = await apiRequest<any>("/api/map");
      if (mapData.data.nodes.length >= 2) {
        const from = mapData.data.nodes[0].id;
        const to = mapData.data.nodes[1].id;

        const { status, data } = await apiRequest<any>(
          `/api/map/route?from=${from}&to=${to}`
        );

        // 可能成功或無路徑
        expect([200, 404]).toContain(status);
        if (status === 200) {
          expect(data.route).toBeDefined();
          expect(data.route.path).toBeDefined();
          expect(typeof data.route.total_cost).toBe("number");
        }
      }
    });
  });

  // ========== PUT /api/map/edges/:id ==========
  describe("PUT /api/map/edges/:id - 更新邊", () => {
    it("MAP-EDGE-002: 不存在的 edge", async () => {
      const user = await createTestUser();

      const { status } = await authenticatedRequest<any>(
        "/api/map/edges/999999",
        user.token,
        {
          method: "PUT",
          body: JSON.stringify({ cost: 100 }),
        }
      );

      // 可能是 404 或其他錯誤
      expect([404, 500]).toContain(status);
    });
  });
});
