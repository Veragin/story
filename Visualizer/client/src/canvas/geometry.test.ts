import { describe, expect, it } from 'vitest';
import {
    boundsOf,
    closestPointOnSegment,
    distanceToSegment,
    nearestEdge,
    nearestVertex,
    normalizeRect,
    pointInPolygon,
    pointInRect,
    polygonArea,
    polygonBorderPoint,
    polygonCentroid,
    rectBorderPoint,
    rectsIntersect,
    segmentIntersection,
} from './geometry';

const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
];

describe('geometry', () => {
    it('pointInPolygon handles convex and concave polygons', () => {
        expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
        expect(pointInPolygon({ x: -1, y: -1 }, square)).toBe(false);
        // U shape: the notch is outside
        const u = [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 7 },
            { x: 7, y: 7 },
            { x: 7, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        expect(pointInPolygon({ x: 5, y: 3 }, u)).toBe(false);
        expect(pointInPolygon({ x: 1, y: 3 }, u)).toBe(true);
        expect(pointInPolygon({ x: 5, y: 9 }, u)).toBe(true);
    });

    it('distanceToSegment measures to the segment, not the infinite line', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 10, y: 0 };
        expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
        expect(distanceToSegment({ x: 13, y: 4 }, a, b)).toBeCloseTo(5);
        expect(distanceToSegment({ x: 2, y: 2 }, a, a)).toBeCloseTo(Math.SQRT2 * 2);
        expect(closestPointOnSegment({ x: -5, y: 1 }, a, b)).toEqual({ x: 0, y: 0 });
    });

    it('nearestEdge finds the edge index, point and t', () => {
        const e = nearestEdge({ x: 11, y: 4 }, square);
        expect(e?.index).toBe(1);
        expect(e?.point.x).toBeCloseTo(10);
        expect(e?.point.y).toBeCloseTo(4);
        expect(e?.t).toBeCloseTo(0.4);
        expect(e?.distance).toBeCloseTo(1);
        // closing edge 3 → 0
        expect(nearestEdge({ x: -1, y: 5 }, square)?.index).toBe(3);
        // open polyline has no closing edge
        expect(nearestEdge({ x: -1, y: 8 }, square, false)?.index).toBe(2);
        expect(nearestEdge({ x: 0, y: 0 }, [{ x: 1, y: 1 }])).toBeNull();
    });

    it('nearestVertex respects the max distance', () => {
        expect(nearestVertex({ x: 9, y: 9 }, square, 2)).toBe(2);
        expect(nearestVertex({ x: 5, y: 5 }, square, 2)).toBe(-1);
    });

    it('rect helpers', () => {
        const r = { x: 0, y: 0, width: 10, height: 5 };
        expect(pointInRect({ x: 10, y: 5 }, r)).toBe(true);
        expect(pointInRect({ x: 11, y: 5 }, r)).toBe(false);
        expect(pointInRect({ x: 11, y: 5 }, r, 1)).toBe(true);
        expect(normalizeRect({ x: 10, y: 10, width: -4, height: -6 })).toEqual({ x: 6, y: 4, width: 4, height: 6 });
        expect(rectsIntersect(r, { x: 9, y: 4, width: 3, height: 3 })).toBe(true);
        expect(rectsIntersect(r, { x: 11, y: 0, width: 3, height: 3 })).toBe(false);
        expect(boundsOf(square)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    });

    it('rectBorderPoint hits the side the ray leaves through', () => {
        const r = { x: 0, y: 0, width: 20, height: 10 };
        expect(rectBorderPoint(r, { x: 100, y: 5 })).toEqual({ x: 20, y: 5 });
        expect(rectBorderPoint(r, { x: 10, y: -100 })).toEqual({ x: 10, y: 0 });
        const corner = rectBorderPoint(r, { x: 30, y: 15 });
        expect(corner.x).toBeCloseTo(20);
        expect(corner.y).toBeCloseTo(10);
    });

    it('polygon area, centroid and border point', () => {
        expect(Math.abs(polygonArea(square))).toBeCloseTo(100);
        expect(polygonCentroid(square)).toEqual({ x: 5, y: 5 });
        const p = polygonBorderPoint(square, { x: 5, y: 5 }, { x: 50, y: 5 });
        expect(p?.x).toBeCloseTo(10);
        expect(p?.y).toBeCloseTo(5);
    });

    it('segmentIntersection', () => {
        expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({
            x: 5,
            y: 5,
        });
        expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 0 }, { x: 6, y: 1 })).toBeNull();
    });
});
