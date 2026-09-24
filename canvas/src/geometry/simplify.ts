import type { TPoint } from '@story/shared';
import { closestPointOnSegment, distance } from './polygon';

/**
 * Ramer–Douglas–Peucker simplification.
 *
 * This is the second of VISUALIZER_PLAN §4.3's three mitigations for "brush strokes are
 * TypeScript": a freehand stroke arrives as one point per pointer event — hundreds of them for
 * one river — and every one of those would become characters in a file a human has to merge.
 * RDP throws away the points that carry no shape, keeping the ones a reader would have drawn.
 *
 * Run on pointer-up, *before* the stroke is ever persisted, so what the author sees on screen
 * after releasing the mouse is exactly what lands in `data/`. Simplifying at save time instead
 * would mean the map silently changes shape on the next reload.
 *
 * Iterative rather than recursive: a stroke drawn by holding the button through a long drag can
 * be thousands of points, and the naive recursion blows the stack on the pathological input
 * (a nearly-straight line) rather than on the rare one.
 */
export const simplify = (points: readonly TPoint[], epsilon: number): TPoint[] => {
    if (points.length <= 2 || epsilon <= 0) return [...points];

    const keep = new Uint8Array(points.length);
    keep[0] = 1;
    keep[points.length - 1] = 1;

    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length > 0) {
        const [first, last] = stack.pop()!;
        if (last <= first + 1) continue;

        let maxDistance = 0;
        let index = first;
        for (let i = first + 1; i < last; i++) {
            const d = distance(points[i], closestPointOnSegment(points[i], points[first], points[last]));
            if (d > maxDistance) {
                maxDistance = d;
                index = i;
            }
        }

        if (maxDistance > epsilon) {
            keep[index] = 1;
            stack.push([first, index], [index, last]);
        }
    }

    const result: TPoint[] = [];
    for (let i = 0; i < points.length; i++) {
        if (keep[i]) result.push(points[i]);
    }
    return result;
};

/**
 * `[x, y, x, y, …]` — Konva's native `Line.points` format, and what `TMap.strokes` stores
 * (§4.3: a flat array roughly halves the character count of the equivalent `TPoint[]`).
 */
export const toFlatPoints = (points: readonly TPoint[]): number[] => {
    const flat: number[] = new Array(points.length * 2);
    for (let i = 0; i < points.length; i++) {
        flat[i * 2] = points[i].x;
        flat[i * 2 + 1] = points[i].y;
    }
    return flat;
};

/** Inverse of `toFlatPoints`. A trailing odd number is dropped rather than read as `{x, NaN}`. */
export const fromFlatPoints = (flat: readonly number[]): TPoint[] => {
    const points: TPoint[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
        points.push({ x: flat[i], y: flat[i + 1] });
    }
    return points;
};
