import type { TPoint } from '@story/shared';

export const BOX = { width: 180, height: 64 } as const;
export const GAP = { x: 90, y: 40, band: 80 } as const;

type TLayoutNode = { id: string; group: string };
type TLayoutEdge = { from: string; to: string };

const STEP_X = BOX.width + GAP.x;
const STEP_Y = BOX.height + GAP.y;

const rankNodes = (nodes: TLayoutNode[], edges: TLayoutEdge[]): Map<string, number> => {
    const groupOf = new Map(nodes.map((n) => [n.id, n.group]));
    const out = new Map<string, string[]>();
    const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    for (const e of edges) {
        if (e.from === e.to || !groupOf.has(e.from) || !groupOf.has(e.to)) continue;
        if (groupOf.get(e.from) !== groupOf.get(e.to)) continue;
        out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
        indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    }

    const rank = new Map<string, number>();
    const bfs = (roots: string[]) => {
        const queue = roots.filter((r) => !rank.has(r));
        queue.forEach((r) => rank.set(r, 0));
        while (queue.length > 0) {
            const id = queue.shift() as string;
            for (const next of out.get(id) ?? []) {
                if (rank.has(next)) continue;
                rank.set(next, (rank.get(id) ?? 0) + 1);
                queue.push(next);
            }
        }
    };

    const sorted = [...nodes].sort(compareNodes);
    bfs(sorted.filter((n) => indegree.get(n.id) === 0).map((n) => n.id));
    // Whatever is left sits in a cycle nobody enters: start from its "intro", else its first id.
    for (;;) {
        const rest = sorted.filter((n) => !rank.has(n.id));
        if (rest.length === 0) break;
        bfs([(rest.find((n) => n.id.endsWith('-intro')) ?? rest[0]).id]);
    }
    return rank;
};

// a stable order keeps the layout stable between runs
const compareNodes = (a: TLayoutNode, b: TLayoutNode) => {
    const ai = a.id.endsWith('-intro') ? 0 : 1;
    const bi = b.id.endsWith('-intro') ? 0 : 1;
    return ai - bi || a.id.localeCompare(b.id);
};

export const layeredLayout = (
    nodes: TLayoutNode[],
    edges: TLayoutEdge[],
    origin: TPoint = { x: 0, y: 0 }
): Record<string, TPoint> => {
    const rank = rankNodes(nodes, edges);
    const groups = [...new Set(nodes.map((n) => n.group))].sort();
    const result: Record<string, TPoint> = {};
    let top = origin.y;
    for (const group of groups) {
        const columns = new Map<number, string[]>();
        for (const n of nodes.filter((n) => n.group === group).sort(compareNodes)) {
            const r = rank.get(n.id) ?? 0;
            columns.set(r, [...(columns.get(r) ?? []), n.id]);
        }
        let rows = 1;
        for (const [r, ids] of columns) {
            ids.forEach((id, i) => (result[id] = { x: origin.x + r * STEP_X, y: top + i * STEP_Y }));
            rows = Math.max(rows, ids.length);
        }
        top += rows * STEP_Y + GAP.band;
    }
    return result;
};

const overlaps = (a: TPoint, b: TPoint) =>
    Math.abs(a.x - b.x) < BOX.width + GAP.x / 3 && Math.abs(a.y - b.y) < BOX.height + GAP.y / 2;

export const placeMissing = (
    nodes: TLayoutNode[],
    edges: TLayoutEdge[],
    fixed: Record<string, TPoint>
): Record<string, TPoint> => {
    const missing = nodes.filter((n) => !fixed[n.id]);
    if (missing.length === 0) return {};
    const placed = nodes.filter((n) => fixed[n.id]);
    if (placed.length === 0) return layeredLayout(nodes, edges);

    const occupied: TPoint[] = placed.map((n) => fixed[n.id]);
    const positions: Record<string, TPoint> = { ...fixed };
    const result: Record<string, TPoint> = {};
    const rank = rankNodes(nodes, edges);
    const order = [...missing].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) || compareNodes(a, b));

    const bottom = () => Math.max(...occupied.map((p) => p.y));
    const left = () => Math.min(...occupied.map((p) => p.x));

    for (const n of order) {
        const pred = edges.find((e) => e.to === n.id && e.from !== n.id && positions[e.from]);
        const succ = edges.find((e) => e.from === n.id && e.to !== n.id && positions[e.to]);
        let p: TPoint = pred
            ? { x: positions[pred.from].x + STEP_X, y: positions[pred.from].y }
            : succ
              ? { x: positions[succ.to].x - STEP_X, y: positions[succ.to].y }
              : { x: left(), y: bottom() + STEP_Y + GAP.band };
        while (occupied.some((o) => overlaps(o, p))) p = { x: p.x, y: p.y + STEP_Y };
        occupied.push(p);
        positions[n.id] = p;
        result[n.id] = p;
    }
    return result;
};
