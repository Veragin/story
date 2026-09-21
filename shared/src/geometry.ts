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
