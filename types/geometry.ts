/**
 * Geometry primitives. Previously ambient globals in `src/@types/global.d.ts`;
 * real exported types now (REFACTOR_PLAN §3).
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
