import { describe, expect, it } from 'vitest';
import {
    area,
    bbox,
    bboxContains,
    bboxFromCorners,
    bboxIntersects,
    centroid,
    closeRing,
    closestPointOnSegment,
    distanceToOutline,
    expandBBox,
    findVertexNear,
    fromFlatPoints,
    isClockwise,
    isEmptyBBox,
    isPointInBBox,
    isPointInPolygon,
    isSelfIntersecting,
    openRing,
    roundPolygon,
    simplify,
    toClockwise,
    toFlatPoints,
    translatePolygon,
    unionBBox,
} from '../src/geometry';

/** A 10×10 square, clockwise on canvas (y down). */
const SQUARE = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
];

describe('rings', () => {
    it('opens an explicitly closed ring', () => {
        expect(openRing([...SQUARE, { x: 0, y: 0 }])).toHaveLength(4);
    });

    it('leaves an already-open ring alone', () => {
        expect(openRing(SQUARE)).toHaveLength(4);
    });

    it('closes a ring by repeating the first point', () => {
        const closed = closeRing(SQUARE);
        expect(closed).toHaveLength(5);
        expect(closed[4]).toEqual(closed[0]);
    });

    it('round-trips open → close → open', () => {
        expect(openRing(closeRing(SQUARE))).toEqual(SQUARE);
    });

    it('treats the empty ring as empty rather than throwing', () => {
        expect(closeRing([])).toEqual([]);
        expect(openRing([])).toEqual([]);
    });
});

describe('area and winding', () => {
    it('measures a square', () => {
        expect(area(SQUARE)).toBe(100);
    });

    it('is zero for a degenerate ring', () => {
        expect(
            area([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ])
        ).toBe(0);
        expect(area([])).toBe(0);
    });

    it('is sign-independent', () => {
        expect(area([...SQUARE].reverse())).toBe(100);
    });

    it('detects canvas-clockwise winding', () => {
        expect(isClockwise(SQUARE)).toBe(true);
        expect(isClockwise([...SQUARE].reverse())).toBe(false);
    });

    it('normalises winding while keeping the first vertex first', () => {
        const counter = [...SQUARE].reverse();
        const normalised = toClockwise(counter);
        expect(isClockwise(normalised)).toBe(true);
        expect(normalised[0]).toEqual(counter[0]);
    });

    it('leaves an already-clockwise ring untouched', () => {
        expect(toClockwise(SQUARE)).toEqual(SQUARE);
    });
});

describe('centroid', () => {
    it('finds the middle of a square', () => {
        expect(centroid(SQUARE)).toEqual({ x: 5, y: 5 });
    });

    /**
     * The reason the implementation uses the area centroid rather than the vertex average:
     * adding vertices along one edge must not drag the label toward that edge.
     */
    it('does not drift when one edge is subdivided', () => {
        const subdivided = [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 4, y: 0 },
            { x: 6, y: 0 },
            { x: 8, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const result = centroid(subdivided);
        expect(result.x).toBeCloseTo(5, 6);
        expect(result.y).toBeCloseTo(5, 6);
    });

    it('falls back to the vertex average for a zero-area ring', () => {
        expect(
            centroid([
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 8, y: 0 },
            ])
        ).toEqual({ x: 4, y: 0 });
    });

    it('survives the empty ring', () => {
        expect(centroid([])).toEqual({ x: 0, y: 0 });
    });
});

describe('bounding boxes', () => {
    it('bounds a square', () => {
        expect(bbox(SQUARE)).toEqual({ min: { x: 0, y: 0 }, max: { x: 10, y: 10 } });
    });

    it('returns an empty box for no points, not 0,0,0,0', () => {
        const box = bbox([]);
        expect(isEmptyBBox(box)).toBe(true);
        expect(isEmptyBBox(bbox(SQUARE))).toBe(false);
    });

    it('treats the empty box as the identity of union', () => {
        const square = bbox(SQUARE);
        expect(unionBBox(bbox([]), square)).toEqual(square);
        expect(unionBBox(square, bbox([]))).toEqual(square);
    });

    it('unions two boxes', () => {
        const a = bboxFromCorners({ x: 0, y: 0 }, { x: 5, y: 5 });
        const b = bboxFromCorners({ x: 3, y: 8 }, { x: 12, y: 9 });
        expect(unionBBox(a, b)).toEqual({ min: { x: 0, y: 0 }, max: { x: 12, y: 9 } });
    });

    it('builds a box from corners in any order', () => {
        expect(bboxFromCorners({ x: 10, y: 10 }, { x: 0, y: 0 })).toEqual(
            bboxFromCorners({ x: 0, y: 0 }, { x: 10, y: 10 })
        );
    });

    it('expands and shrinks', () => {
        expect(expandBBox(bbox(SQUARE), 2)).toEqual({ min: { x: -2, y: -2 }, max: { x: 12, y: 12 } });
        expect(expandBBox(bbox([]), 2)).toEqual(bbox([]));
    });

    it('tests containment inclusively', () => {
        expect(isPointInBBox({ x: 0, y: 0 }, bbox(SQUARE))).toBe(true);
        expect(isPointInBBox({ x: 11, y: 5 }, bbox(SQUARE))).toBe(false);
    });

    it('distinguishes contains from intersects', () => {
        const outer = bboxFromCorners({ x: 0, y: 0 }, { x: 10, y: 10 });
        const straddling = bboxFromCorners({ x: 8, y: 8 }, { x: 20, y: 20 });
        expect(bboxIntersects(outer, straddling)).toBe(true);
        expect(bboxContains(outer, straddling)).toBe(false);
        expect(bboxContains(outer, bboxFromCorners({ x: 2, y: 2 }, { x: 4, y: 4 }))).toBe(true);
    });

    it('never contains or intersects an empty box', () => {
        expect(bboxContains(bbox(SQUARE), bbox([]))).toBe(false);
        expect(bboxIntersects(bbox(SQUARE), bbox([]))).toBe(false);
    });
});

describe('point in polygon', () => {
    it('finds the inside and the outside', () => {
        expect(isPointInPolygon({ x: 5, y: 5 }, SQUARE)).toBe(true);
        expect(isPointInPolygon({ x: 15, y: 5 }, SQUARE)).toBe(false);
        expect(isPointInPolygon({ x: -1, y: -1 }, SQUARE)).toBe(false);
    });

    it('is false for anything with fewer than three points', () => {
        expect(
            isPointInPolygon({ x: 0, y: 0 }, [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ])
        ).toBe(false);
    });

    /** Even-odd: the notch is outside even though it is within the bounding box. */
    it('handles a concave ring', () => {
        const arrow = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 5, y: 5 },
            { x: 0, y: 10 },
        ];
        expect(isPointInPolygon({ x: 5, y: 1 }, arrow)).toBe(true);
        expect(isPointInPolygon({ x: 5, y: 9 }, arrow)).toBe(false);
    });
});

describe('outline distance', () => {
    it('projects a point onto a segment and clamps to its ends', () => {
        expect(closestPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 });
        expect(closestPointOnSegment({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 0, y: 0 });
    });

    it('survives a zero-length segment', () => {
        expect(closestPointOnSegment({ x: 5, y: 5 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    });

    /**
     * `edgeIndex` is the contract `VertexEditTool` inserts against: the returned index is the
     * edge's *first* vertex, so the new point goes at `edgeIndex + 1`.
     */
    it('reports the nearest edge by its first vertex', () => {
        const near = distanceToOutline({ x: 5, y: -1 }, SQUARE);
        expect(near.edgeIndex).toBe(0);
        expect(near.distance).toBeCloseTo(1, 6);
        expect(near.point).toEqual({ x: 5, y: 0 });
    });

    it('considers the implicit closing edge', () => {
        const near = distanceToOutline({ x: -1, y: 5 }, SQUARE);
        expect(near.edgeIndex).toBe(3);
        expect(near.distance).toBeCloseTo(1, 6);
    });

    it('returns infinity for an empty ring rather than NaN', () => {
        expect(distanceToOutline({ x: 0, y: 0 }, []).distance).toBe(Infinity);
    });
});

describe('vertex picking', () => {
    it('finds a vertex within tolerance', () => {
        expect(findVertexNear({ x: 10.5, y: 0.2 }, SQUARE, 1)).toBe(1);
    });

    it('returns -1 when nothing is close enough', () => {
        expect(findVertexNear({ x: 5, y: 5 }, SQUARE, 1)).toBe(-1);
    });

    it('prefers the nearest when two are in range', () => {
        expect(findVertexNear({ x: 9, y: 1 }, SQUARE, 20)).toBe(1);
    });
});

describe('transforms', () => {
    it('translates every point', () => {
        expect(translatePolygon(SQUARE, { x: 5, y: -5 })[0]).toEqual({ x: 5, y: -5 });
    });

    it('rounds coordinates', () => {
        expect(roundPolygon([{ x: 1.4, y: 2.6 }])).toEqual([{ x: 1, y: 3 }]);
    });
});

describe('self-intersection', () => {
    it('accepts a simple ring', () => {
        expect(isSelfIntersecting(SQUARE)).toBe(false);
    });

    it('accepts a triangle', () => {
        expect(
            isSelfIntersecting([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 5, y: 10 },
            ])
        ).toBe(false);
    });

    it('rejects a bowtie', () => {
        const bowtie = [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
        ];
        expect(isSelfIntersecting(bowtie)).toBe(true);
    });

    it('does not count shared vertices between adjacent edges as a crossing', () => {
        const concave = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 5, y: 5 },
            { x: 0, y: 10 },
        ];
        expect(isSelfIntersecting(concave)).toBe(false);
    });
});

describe('simplify (RDP)', () => {
    it('collapses a straight line to its endpoints', () => {
        const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
        expect(simplify(line, 1)).toEqual([
            { x: 0, y: 0 },
            { x: 49, y: 0 },
        ]);
    });

    it('keeps a corner the epsilon cannot explain away', () => {
        const corner = [
            { x: 0, y: 0 },
            { x: 5, y: 10 },
            { x: 10, y: 0 },
        ];
        expect(simplify(corner, 1)).toHaveLength(3);
    });

    it('drops a wobble smaller than epsilon', () => {
        const wobble = [
            { x: 0, y: 0 },
            { x: 5, y: 0.4 },
            { x: 10, y: 0 },
        ];
        expect(simplify(wobble, 1)).toHaveLength(2);
    });

    it('always keeps both endpoints', () => {
        const noisy = Array.from({ length: 200 }, (_, i) => ({ x: i, y: (i % 3) * 0.1 }));
        const result = simplify(noisy, 5);
        expect(result[0]).toEqual(noisy[0]);
        expect(result[result.length - 1]).toEqual(noisy[noisy.length - 1]);
    });

    it('is a no-op for epsilon <= 0 or two points', () => {
        expect(simplify(SQUARE, 0)).toEqual(SQUARE);
        expect(
            simplify(
                [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                ],
                10
            )
        ).toHaveLength(2);
    });

    /**
     * The iterative implementation exists so that the pathological input — a near-straight line
     * thousands of points long, which is what holding the brush down actually produces — does
     * not overflow the stack.
     */
    it('handles a stroke long enough to blow a recursive implementation', () => {
        const long = Array.from({ length: 50_000 }, (_, i) => ({ x: i, y: Math.sin(i / 5000) }));
        expect(() => simplify(long, 0.001)).not.toThrow();
    });
});

describe('flat points', () => {
    it('round-trips', () => {
        expect(fromFlatPoints(toFlatPoints(SQUARE))).toEqual(SQUARE);
    });

    it('produces Konva’s [x, y, …] order', () => {
        expect(
            toFlatPoints([
                { x: 1, y: 2 },
                { x: 3, y: 4 },
            ])
        ).toEqual([1, 2, 3, 4]);
    });

    it('drops a trailing odd coordinate rather than emitting a NaN point', () => {
        expect(fromFlatPoints([1, 2, 3])).toEqual([{ x: 1, y: 2 }]);
    });
});
