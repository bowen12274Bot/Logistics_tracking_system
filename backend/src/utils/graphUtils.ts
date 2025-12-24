
export type NodeRow = { id: string };
export type EdgeRow = { source: string; target: string; cost?: number };

export function normalizeNodeId(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

export function buildGraph(nodes: NodeRow[], edges: EdgeRow[]) {
  const nodeIds = new Set(nodes.map((n) => normalizeNodeId(n.id)).filter(Boolean));
  const adj = new Map<string, Array<{ to: string; cost: number }>>();

  const add = (a: string, b: string, cost: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ to: b, cost });
  };

  for (const e of edges) {
    const a = normalizeNodeId(e.source);
    const b = normalizeNodeId(e.target);
    const cost = Number(e.cost ?? 1); // default cost 1 if not provided (e.g. for hop count or simple adjacency)
    if (!a || !b) continue;
    add(a, b, cost);
    add(b, a, cost);
  }

  return { nodeIds, adj };
}


export function dijkstraCost(
  graph: { nodeIds: Set<string>; adj: Map<string, Array<{ to: string; cost: number }>> },
  from: string,
  to: string,
) {
  const result = computeShortestPath(graph, from, to);
  return result ? result.cost : null;
}

export function computeShortestPath(
  graph: { nodeIds: Set<string>; adj: Map<string, Array<{ to: string; cost: number }>> },
  from: string,
  to: string,
) {
  const start = normalizeNodeId(from);
  const goal = normalizeNodeId(to);
  if (!start || !goal) return null;
  if (!graph.nodeIds.has(start) || !graph.nodeIds.has(goal)) return null;
  if (start === goal) return { cost: 0, path: [start] };

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const pq: Array<{ node: string; d: number }> = [{ node: start, d: 0 }];
  dist.set(start, 0);

  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const cur = pq.shift()!;
    if (visited.has(cur.node)) continue;
    visited.add(cur.node);
    
    if (cur.node === goal) {
      // Reconstruct path
      const path: string[] = [];
      let curr: string | undefined = goal;
      while (curr) {
        path.unshift(curr);
        curr = prev.get(curr);
      }
      return { cost: cur.d, path };
    }

    for (const nxt of graph.adj.get(cur.node) ?? []) {
      if (visited.has(nxt.to)) continue;
      const nd = cur.d + nxt.cost;
      const best = dist.get(nxt.to);
      if (best === undefined || nd < best) {
        dist.set(nxt.to, nd);
        prev.set(nxt.to, cur.node);
        pq.push({ node: nxt.to, d: nd });
      }
    }
  }

  return null;
}
