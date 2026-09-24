import type { register } from '@story/data';
import type { TColor, TPoint, TSize } from '@story/shared';

/**
 * A map the author draws locations on (VISUALIZER_PLAN §4.3).
 *
 * New in this plan: there was no map type and no `data/maps/` — maps existed only in the
 * Visualizer's dead API client and as a `width × height` grid of palette ids in
 * `MapEditor/types.ts`. Nothing in the README ever asked for a tile grid; it asks for polygon
 * locations, a brush and notes. The tile model is replaced, not extended (§1.1).
 *
 * A map is an author entity like a location, so it gets a type here and a folder under
 * `data/maps/`, and `TMapId` derives from `register.maps` exactly the way `TLocationId` derives
 * from `register.locations`.
 *
 * ## Where a location's shape lives
 *
 * Not here. A map holds its own furniture — background, notes, brush strokes, nested maps — and
 * each *location* carries its own polygon in `TLocation.shape`, naming the map it sits on. That
 * way adding a location is one edit to one file the author already has open, and a map file
 * does not have to be rewritten every time a border moves. It also means a location with no
 * place on any map is simply one without `shape`, rather than an absence the map file has to
 * represent.
 */
export type TMap<M extends TMapId> = {
    id: M;
    title: string;

    /** Extent of the map in world units — the coordinate space every shape on it is in. */
    size: TSize;

    /** Optional bitmap under everything else: a drawn or scanned map the author traces. */
    background?: {
        /** Key into `data/assets` — resolved the same way passage art is. */
        asset: string;
        position: TPoint;
        size: TSize;
    };

    /** Free text placed in world space: "the Nen", "here be dragons". */
    notes: {
        id: string;
        text: string;
        position: TPoint;
        /** Degrees clockwise. For running a river's name along the river. */
        rotation?: number;
        color?: TColor;
    }[];

    /**
     * Freehand strokes — rivers, roads, coastlines.
     *
     * `points` is a **flat `[x, y, …]` array**, not `TPoint[]`: it is roughly half the
     * characters of the equivalent object array and it is Konva's native `Line.points` format,
     * so nothing converts on the draw path. §4.3 is explicit that this is the one place where
     * "everything in TypeScript" costs something, and it names three mitigations — coordinates
     * are rounded to integers and simplified with Ramer–Douglas–Peucker before anything is ever
     * written (both in `@story/canvas`'s `BrushStroke.finish`), and the server refuses a
     * `strokes` payload over a size budget with `413` rather than writing a file no one can
     * merge.
     */
    strokes: {
        id: string;
        color: TColor;
        /** World units, so a stroke scales with the map rather than with the zoom. */
        width: number;
        points: number[];
    }[];

    /**
     * Maps placed inside this one — a town plan pinned to its position on the world map.
     * Replaces the tile model's `maps` list.
     */
    maps?: { mapId: TMapId; position: TPoint }[];
};

/**
 * Every map id in the story. Derived from `register.maps`, so adding a file and registering it
 * is the whole of "adding a map" — the same shape as `TLocationId` and `TChapterId`.
 */
export type TMapId = keyof (typeof register)['maps'];
