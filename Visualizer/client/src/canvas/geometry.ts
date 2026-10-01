import type { TPoint, TRect } from './types';

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const add = (a: TPoint, b: TPoint): TPoint => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: TPoint, b: TPoint): TPoint => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: TPoint, k: number): TPoint => ({ x: a.x * k, y: a.y * k });
export const dot = (a: TPoint, b: TPoint): number => a.x * b.x + a.y * b.y;
export const cross = (a: TPoint, b: TPoint): number => a.x * b.y - a.y * b.x;
export const distance = (a: TPoint, b: TPoint): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: TPoint, b: TPoint, t: number): TPoint => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
});

export const projectOnSegment = (p: TPoint, a: TPoint, b: TPoint): number => {
    const ab = sub(b, a);
    const len2 = dot(ab, ab);
    if (len2 === 0) return 0;
    return clamp(dot(sub(p, a), ab) / len2, 0, 1);
};

export const closestPointOnSegment = (p: TPoint, a: TPoint, b: TPoint): TPoint => lerp(a, b, projectOnSegment(p, a, b));

export const distanceToSegment = (p: TPoint, a: TPoint, b: TPoint): number =>
    distance(p, closestPointOnSegment(p, a, b));

// on-edge points may go either way; use `distanceToPolygonEdge` for tolerance
export const pointInPolygon = (p: TPoint, polygon: readonly TPoint[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
};

export type TNearestEdge = {
    // edge `index` runs from vertex `index` to `(index + 1) % n`
    index: number;
    distance: number;
    point: TPoint;
    t: number;
};

export const nearestEdge = (p: TPoint, points: readonly TPoint[], closed = true): TNearestEdge | null => {
    const n = points.length;
    if (n < 2) return null;
    const edges = closed ? n : n - 1;
    let best: TNearestEdge | null = null;
    for (let i = 0; i < edges; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const t = projectOnSegment(p, a, b);
        const point = lerp(a, b, t);
        const d = distance(p, point);
        if (!best || d < best.distance) best = { index: i, distance: d, point, t };
    }
    return best;
};

export const distanceToPolygonEdge = (p: TPoint, points: readonly TPoint[]): number =>
    nearestEdge(p, points)?.distance ?? Infinity;

export const nearestVertex = (p: TPoint, points: readonly TPoint[], maxDistance = Infinity): number => {
    let best = -1;
    let bestD = maxDistance;
    points.forEach((v, i) => {
        const d = distance(p, v);
        if (d <= bestD) {
            best = i;
            bestD = d;
        }
    });
    return best;
};

export const pointInRect = (p: TPoint, r: TRect, tolerance = 0): boolean =>
    p.x >= r.x - tolerance &&
    p.x <= r.x + r.width + tolerance &&
    p.y >= r.y - tolerance &&
    p.y <= r.y + r.height + tolerance;

export const normalizeRect = (r: TRect): TRect => {
    const x = Math.min(r.x, r.x + r.width);
    const y = Math.min(r.y, r.y + r.height);
    return { x, y, width: Math.abs(r.width), height: Math.abs(r.height) };
};

export const rectsIntersect = (a: TRect, b: TRect): boolean =>
    a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

export const rectCenter = (r: TRect): TPoint => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

export const rectToPolygon = (r: TRect): TPoint[] => {
    return [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
};

export const boundsOf = (points: readonly TPoint[]): TRect => {
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

// positive for clockwise in screen coordinates (y down)
export const polygonArea = (points: readonly TPoint[]): number => {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        area += cross(points[j], points[i]);
    }
    return area / 2;
};

export const polygonCentroid = (points: readonly TPoint[]): TPoint => {
    const area = polygonArea(points);
    if (points.length === 0) return { x: 0, y: 0 };
    if (Math.abs(area) < 1e-9) {
        const s = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
        return scale(s, 1 / points.length);
    }
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const f = cross(points[j], points[i]);
        cx += (points[j].x + points[i].x) * f;
        cy += (points[j].y + points[i].y) * f;
    }
    return { x: cx / (6 * area), y: cy / (6 * area) };
};

export const segmentIntersection = (p1: TPoint, p2: TPoint, p3: TPoint, p4: TPoint): TPoint | null => {
    const r = sub(p2, p1);
    const s = sub(p4, p3);
    const denom = cross(r, s);
    if (Math.abs(denom) < 1e-12) return null;
    const qp = sub(p3, p1);
    const t = cross(qp, s) / denom;
    const u = cross(qp, r) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return lerp(p1, p2, t);
};

export const polygonBorderPoint = (points: readonly TPoint[], inside: TPoint, outside: TPoint): TPoint | null => {
    let best: TPoint | null = null;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
        const hit = segmentIntersection(inside, outside, points[i], points[(i + 1) % points.length]);
        if (hit) {
            const d = distance(inside, hit);
            if (d < bestD) {
                best = hit;
                bestD = d;
            }
        }
    }
    return best;
};

export const rectBorderPoint = (r: TRect, toward: TPoint): TPoint => {
    const c = rectCenter(r);
    const d = sub(toward, c);
    if (d.x === 0 && d.y === 0) return c;
    const hw = r.width / 2;
    const hh = r.height / 2;
    const tx = d.x !== 0 ? hw / Math.abs(d.x) : Infinity;
    const ty = d.y !== 0 ? hh / Math.abs(d.y) : Infinity;
    const t = Math.min(tx, ty);
    return add(c, scale(d, t));
};
