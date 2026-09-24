import type { TBBox, TPoint, TPolygon } from '@story/shared';

/**
 * Polygon math, all of it in world units and none of it aware of a canvas
 * (VISUALIZER_PLAN §3.2 `geometry/`, design rule 1).
 *
 * Every function here treats a polygon as an *implicitly closed* ring, matching `TPolygon`:
 * the edge from `points[n-1]` back to `points[0]` is real and is iterated like any other. A
 * caller that hands in a duplicated first-and-last point gets a degenerate zero-length edge,
 * which is harmless for every routine below but is why `closeRing` exists.
 */

/** Drops a trailing point equal to the first, so an explicitly-closed ring becomes a `TPolygon`. */
export const openRing = (points: TPolygon): TPolygon => {
    if (points.length < 2) return points;
    const first = points[0];
    const last = points[points.length - 1];
    return first.x === last.x && first.y === last.y ? points.slice(0, -1) : points;
};

/** Appends a copy of the first point. For handing a ring to an API that wants it explicit. */
export const closeRing = (points: TPolygon): TPoint[] => {
    const open = openRing(points);
    return open.length === 0 ? [] : [...open, open[0]];
};

/**
 * Twice the signed area (the "shoelace" sum). Positive is counter-clockwise in a
 * y-up frame — and therefore *clockwise* on a canvas, where y grows downward. Exported
 * because the sign is the cheapest winding test there is.
 */
export const signedArea2 = (points: TPolygon): number => {
    let sum = 0;
    for (let i = 0, n = points.length; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        sum += a.x * b.y - b.x * a.y;
    }
    return sum;
};

/** Unsigned area. Zero for fewer than three points and for any degenerate ring. */
export const area = (points: TPolygon): number => (points.length < 3 ? 0 : Math.abs(signedArea2(points)) / 2);

/** True when the ring winds clockwise *as drawn on a canvas* (y down). */
export const isClockwise = (points: TPolygon): boolean => signedArea2(points) > 0;

/** Reverses the ring in place-free fashion, keeping `points[0]` as the first vertex. */
export const reverseWinding = (points: TPolygon): TPoint[] =>
    points.length === 0 ? [] : [points[0], ...points.slice(1).reverse()];

/** Returns the ring wound clockwise on canvas, which is the convention `TLocation.shape` stores. */
export const toClockwise = (points: TPolygon): TPoint[] => (isClockwise(points) ? [...points] : reverseWinding(points));

/**
 * Area centroid, not the average of the vertices: the average drags toward whichever side the
 * author happened to click more points on, which would make a location's label drift as it is
 * reshaped. Falls back to the vertex average for a degenerate (zero-area) ring, where the area
 * formula divides by zero.
 */
export const centroid = (points: TPolygon): TPoint => {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length < 3) return vertexAverage(points);

    const a2 = signedArea2(points);
    if (a2 === 0) return vertexAverage(points);

    let cx = 0;
    let cy = 0;
    for (let i = 0, n = points.length; i < n; i++) {
        const p = points[i];
        const q = points[(i + 1) % n];
        const cross = p.x * q.y - q.x * p.y;
        cx += (p.x + q.x) * cross;
        cy += (p.y + q.y) * cross;
    }
    return { x: cx / (3 * a2), y: cy / (3 * a2) };
};

const vertexAverage = (points: TPolygon): TPoint => {
    let x = 0;
    let y = 0;
    for (const p of points) {
        x += p.x;
        y += p.y;
    }
    return { x: x / points.length, y: y / points.length };
};

/** Axis-aligned bounds. An empty ring yields the empty box (`min` > `max`), never `0,0,0,0`. */
export const bbox = (points: TPolygon): TBBox => {
    if (points.length === 0) {
        return { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
};

/** True when the box has no extent — i.e. it came from an empty point set. */
export const isEmptyBBox = (box: TBBox): boolean => box.min.x > box.max.x || box.min.y > box.max.y;

/** The union of two boxes, treating an empty box as the identity. */
export const unionBBox = (a: TBBox, b: TBBox): TBBox => {
    if (isEmptyBBox(a)) return b;
    if (isEmptyBBox(b)) return a;
    return {
        min: { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y) },
        max: { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y) },
    };
};

/** Grows a box by `amount` on every side. Negative shrinks; an empty box stays empty. */
export const expandBBox = (box: TBBox, amount: number): TBBox =>
    isEmptyBBox(box)
        ? box
        : {
              min: { x: box.min.x - amount, y: box.min.y - amount },
              max: { x: box.max.x + amount, y: box.max.y + amount },
          };

/** Inclusive point-in-box. */
export const isPointInBBox = (point: TPoint, box: TBBox): boolean =>
    point.x >= box.min.x && point.x <= box.max.x && point.y >= box.min.y && point.y <= box.max.y;

/** True when the two boxes share any area or edge. */
export const bboxIntersects = (a: TBBox, b: TBBox): boolean =>
    !isEmptyBBox(a) &&
    !isEmptyBBox(b) &&
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y;

/** True when `inner` lies entirely within `outer` — what marquee selection asks. */
export const bboxContains = (outer: TBBox, inner: TBBox): boolean =>
    !isEmptyBBox(outer) &&
    !isEmptyBBox(inner) &&
    inner.min.x >= outer.min.x &&
    inner.max.x <= outer.max.x &&
    inner.min.y >= outer.min.y &&
    inner.max.y <= outer.max.y;

/** Builds the box spanned by two arbitrary corners — a drag start and a drag end. */
export const bboxFromCorners = (a: TPoint, b: TPoint): TBBox => ({
    min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
});

/**
 * Even-odd point-in-polygon (the standard crossing-number test).
 *
 * Boundary points are deliberately *undefined* — a point exactly on an edge may land either
 * way depending on float rounding. That is fine for hit-testing a location the author clicked,
 * and `distanceToOutline` is the function to use when the answer has to be stable near an edge.
 */
export const isPointInPolygon = (point: TPoint, points: TPolygon): boolean => {
    if (points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i];
        const b = points[j];
        const straddles = a.y > point.y !== b.y > point.y;
        if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
};

/** Squared distance, for comparisons that do not need the square root. */
export const distanceSq = (a: TPoint, b: TPoint): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

export const distance = (a: TPoint, b: TPoint): number => Math.sqrt(distanceSq(a, b));

/** The point on segment `a→b` closest to `p`. Handles the degenerate `a === b`. */
export const closestPointOnSegment = (p: TPoint, a: TPoint, b: TPoint): TPoint => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: a.x, y: a.y };
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return { x: a.x + t * dx, y: a.y + t * dy };
};

export const distanceToSegment = (p: TPoint, a: TPoint, b: TPoint): number =>
    distance(p, closestPointOnSegment(p, a, b));

/**
 * Distance from `p` to the nearest point of the ring's outline, plus which edge that was.
 * `edgeIndex` is the index of the edge's *first* vertex, so inserting a vertex after it is
 * `splice(edgeIndex + 1, 0, point)` — the operation `VertexEditTool` performs.
 */
export const distanceToOutline = (
    p: TPoint,
    points: TPolygon
): { distance: number; edgeIndex: number; point: TPoint } => {
    if (points.length === 0) return { distance: Infinity, edgeIndex: -1, point: { x: 0, y: 0 } };
    if (points.length === 1) return { distance: distance(p, points[0]), edgeIndex: 0, point: points[0] };

    let best = Infinity;
    let bestIndex = 0;
    let bestPoint = points[0];
    for (let i = 0, n = points.length; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const candidate = closestPointOnSegment(p, a, b);
        const d = distance(p, candidate);
        if (d < best) {
            best = d;
            bestIndex = i;
            bestPoint = candidate;
        }
    }
    return { distance: best, edgeIndex: bestIndex, point: bestPoint };
};

/** Index of the vertex within `tolerance` of `p`, nearest first, or `-1`. */
export const findVertexNear = (p: TPoint, points: TPolygon, tolerance: number): number => {
    let best = tolerance * tolerance;
    let bestIndex = -1;
    for (let i = 0; i < points.length; i++) {
        const d = distanceSq(p, points[i]);
        if (d <= best) {
            best = d;
            bestIndex = i;
        }
    }
    return bestIndex;
};

/** Translates every point by `delta`. */
export const translatePolygon = (points: TPolygon, delta: TPoint): TPoint[] =>
    points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));

/** Rounds every coordinate to an integer — the first of §4.3's three stroke-size mitigations. */
export const roundPolygon = (points: TPolygon): TPoint[] =>
    points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

/**
 * Do two *non-adjacent* edges of the ring cross? A self-intersecting location polygon renders
 * with an even-odd hole and its area/centroid stop meaning anything, so the draw tools warn on
 * it rather than silently storing one.
 *
 * O(n²), which is the right complexity here: rings are hand-drawn and tens of points long, and
 * a sweep-line would be more code than the case justifies.
 */
export const isSelfIntersecting = (points: TPolygon): boolean => {
    const n = points.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            // Skip edges that share a vertex: they always "touch", which is not a crossing.
            if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;
            if (segmentsIntersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) {
                return true;
            }
        }
    }
    return false;
};

const orientation = (a: TPoint, b: TPoint, c: TPoint): number => {
    const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    return v === 0 ? 0 : v > 0 ? 1 : 2;
};

const onSegment = (a: TPoint, b: TPoint, c: TPoint): boolean =>
    b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);

/** Proper-or-collinear segment intersection test. */
export const segmentsIntersect = (p1: TPoint, q1: TPoint, p2: TPoint, q2: TPoint): boolean => {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
};
