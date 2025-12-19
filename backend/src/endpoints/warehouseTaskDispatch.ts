import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

type AuthUser = { id: string; user_class: string; address: string | null };
type NodeRow = { id: string; level: number };
type EdgeRow = { source: string; target: string };

async function requireWarehouse(c: AppContext) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false as const, res: c.json({ error: "Token missing" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
    .bind(token)
    .first<{ user_id: string }>();

  if (!tokenRecord) {
    return { ok: false as const, res: c.json({ error: "Invalid token" }, 401) };
  }

  const user = await c.env.DB.prepare("SELECT id, user_class, address FROM users WHERE id = ?")
    .bind(tokenRecord.user_id)
    .first<AuthUser>();

  if (!user || user.user_class !== "warehouse_staff") {
    return { ok: false as const, res: c.json({ error: "Forbidden" }, 403) };
  }

  return { ok: true as const, user };
}

async function buildMapGraph(db: D1Database) {
  const nodesResult = await db.prepare("SELECT id, level FROM nodes").all();
  const edgesResult = await db.prepare("SELECT source, target FROM edges").all();

  const nodes = (nodesResult.results || []) as NodeRow[];
  const edges = (edgesResult.results || []) as EdgeRow[];

  const levelById = new Map<string, number>();
  for (const n of nodes) levelById.set(String(n.id).trim(), Number(n.level));

  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const e of edges) {
    const a = String(e.source).trim();
    const b = String(e.target).trim();
    if (!a || !b) continue;
    add(a, b);
    add(b, a);
  }

  return { adj, levelById };
}

function findRootHub(startNodeId: string, graph: { adj: Map<string, string[]>; levelById: Map<string, number> }) {
  const start = String(startNodeId).trim();
  if (!start) return null;
  const startLevel = graph.levelById.get(start);
  if (startLevel === 1) return start;

  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const lvl = graph.levelById.get(node);
    if (lvl === 1) return node;
    for (const nei of graph.adj.get(node) ?? []) {
      if (visited.has(nei)) continue;
      visited.add(nei);
      queue.push(nei);
    }
  }
  return null;
}

export class WarehouseDispatchNextTask extends OpenAPIRoute {
  schema = {
    tags: ["Staff"],
    summary: "Warehouse dispatch next delivery task segment",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ packageId: z.string().min(1) }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              toNodeId: z.string().min(1),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "OK" },
      "400": { description: "Invalid request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
      "404": { description: "Not found" },
      "409": { description: "Conflict" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireWarehouse(c);
    if (!auth.ok) return auth.res;

    const data = await this.getValidatedData<typeof this.schema>();
    const packageId = String(data.params.packageId).trim();
    const fromNodeId = String(auth.user.address ?? "").trim().toUpperCase();
    const toNodeId = String((data.body as any).toNodeId ?? "").trim().toUpperCase();

    if (!fromNodeId) return c.json({ error: "Warehouse has no node (users.address)" }, 400);
    if (!toNodeId) return c.json({ error: "Missing toNodeId" }, 400);
    if (fromNodeId === toNodeId) return c.json({ error: "fromNodeId equals toNodeId" }, 400);

    const pkg = await c.env.DB.prepare("SELECT id FROM packages WHERE id = ? LIMIT 1").bind(packageId).first();
    if (!pkg) return c.json({ error: "Package not found" }, 404);

    // Disallow creating next tasks if there's still an active task for this package.
    const active = await c.env.DB.prepare(
      "SELECT 1 AS ok FROM delivery_tasks WHERE package_id = ? AND status IN ('pending','accepted','in_progress') LIMIT 1",
    )
      .bind(packageId)
      .first();
    if (active) return c.json({ error: "Package already has an active task" }, 409);

    // Validate adjacency (1 edge segment)
    const edge = await c.env.DB.prepare(
      "SELECT 1 AS ok FROM edges WHERE (source = ? AND target = ?) OR (source = ? AND target = ?) LIMIT 1",
    )
      .bind(fromNodeId, toNodeId, toNodeId, fromNodeId)
      .first();
    if (!edge) return c.json({ error: "Not adjacent", from: fromNodeId, to: toNodeId }, 400);

    const graph = await buildMapGraph(c.env.DB);
    const hub = findRootHub(fromNodeId, graph);

    // Assign to hub driver (HUB_x driver's users.address is HUB_x)
    let assignedDriverId: string | null = null;
    if (hub) {
      const drv = await c.env.DB.prepare("SELECT id FROM users WHERE user_class = 'driver' AND UPPER(address) = ? LIMIT 1")
        .bind(String(hub).toUpperCase())
        .first<{ id: string }>();
      assignedDriverId = drv?.id ?? null;
    }

    const maxSeg = await c.env.DB.prepare(
      "SELECT MAX(COALESCE(segment_index, 0)) AS max_seg FROM delivery_tasks WHERE package_id = ?",
    )
      .bind(packageId)
      .first<{ max_seg: number | null }>();
    const nextIndex = Number(maxSeg?.max_seg ?? -1) + 1;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `
      INSERT INTO delivery_tasks (
        id, package_id, task_type, from_location, to_location,
        assigned_driver_id, status, segment_index, created_at, updated_at
      ) VALUES (?, ?, 'deliver', ?, ?, ?, 'pending', ?, ?, ?)
      `,
    )
      .bind(id, packageId, fromNodeId, toNodeId, assignedDriverId, nextIndex, now, now)
      .run();

    return c.json({ success: true, task_id: id, assigned_driver_id: assignedDriverId, segment_index: nextIndex });
  }
}

