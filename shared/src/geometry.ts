import type { TFlavor } from './misc';

/**
 * Geometry primitives.
 *
 * Engine plumbing, not part of the author's surface: every consumer is a service
 * (the Visualizer's canvas, SingleEngine), never `data/`. They were ambient globals in
 * `src/@types/global.d.ts`, became exports of `@story/types` in Phase 3, and live here
 * because `types/` is what the author edits and nobody edits a point.
 *
 * `TVec` and `TPoint` are structurally identical on purpose — a point is a position,
 * a vector is a direction/offset. Both names are in use and both are kept.
 *
 * `TPolygon`, `TBBox` and `TColor` were added by VISUALIZER_PLAN §4.1. They are here rather
 * than in `types/` for the same reason as the three above: the author writes a *location's*
 * shape, but a polygon itself is engine plumbing, and `@story/canvas` — which may import
 * `shared` and nothing else internal (§3.1) — has to be able to name one.
 */

export type TPoint = {
    x: number;
    y: number;
};

export type TSize = {
    width: number;
    height: number;
};

export type TVec = {
    x: number;
    y: number;
};

/**
 * A closed polygon in world units. The closing edge from the last point back to the first is
 * implicit — a triangle is three points, never four — because that is the one convention under
 * which "is this ring closed?" can never disagree with "does the last point equal the first?".
 */
export type TPolygon = readonly TPoint[];

/** An axis-aligned bounding box. `max` is inclusive; an empty box has `min` > `max`. */
export type TBBox = {
    min: TPoint;
    max: TPoint;
};

/**
 * A CSS colour string — `#rrggbb`, `rgba(…)`, a named colour. Flavoured rather than a plain
 * `string` so a colour and a title cannot be swapped by accident at a call site; flavour, not
 * brand, because the author hand-writes these in `data/` and must not need a constructor.
 */
export type TColor = TFlavor<string, 'color'>;
