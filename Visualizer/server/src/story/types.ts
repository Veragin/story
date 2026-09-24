import type { TPoint, TPolygon, TSize } from '@story/shared';

/**
 * The shapes the API answers with (VISUALIZER_PLAN §5.3).
 *
 * Deliberately *not* the author's types. `TChapter` carries a `TimeRange` of `Time` instances,
 * a `children` array holding whole nested chapters, and an `init` slice of the world state —
 * none of which a client needs to draw a timeline, and the nesting means one chapter's JSON
 * would drag in every chapter reachable from it. These are flat, id-referenced projections:
 * what the wire carries, versioned independently of what the author writes.
 *
 * Every entry carries `file` and `hash`. `file` is what `POST …/open` sends to the editor;
 * `hash` is the `If-Match` token a write has to send back (§5.3), so a read and its
 * corresponding write agree on what was read without a second round trip.
 */

/** Present on everything that came from a file on disk. */
export type TSourced = {
    /** Repo-relative path, e.g. `data/chapters/village/village.chapter.ts`. */
    file: string;
    /** Content hash of that file at read time — the `If-Match` value for a write. */
    hash: string | null;
};

export type TChapterSummary = TSourced & {
    id: string;
    title: string;
    description: string;
    locationId: string | null;
    /** Seconds since the story epoch — the client has `Time` and can rebuild it. */
    timeRange: { start: number; end: number } | null;
    /** Ids only: the full chapter is one fetch away and nesting would duplicate the graph. */
    childChapterIds: string[];
    triggerIds: string[];
    /** Saved passage positions, `{ [passageId]: {x, y} }` (§4.4). */
    layout: Record<string, TPoint>;
};

export type TPassageSummary = TSourced & {
    /** The whole `<chapter>-<character>-<passage>` id. */
    id: string;
    chapterId: string;
    characterId: string;
    /** The local part — the last segment of the id. */
    localId: string;
    type: 'screen' | 'linear' | 'transition' | 'unknown';
    title: string | null;
    image: string | null;
    /**
     * Passage ids this one can reach.
     *
     * Static, and therefore *approximate*: a passage is a function of `(s, e)` and its links can
     * be computed, so what is listed here is every passage id that appears as a `passageId`,
     * `nextPassageId` or `redirect` literal in the source. A link built by string concatenation
     * is invisible to it. §5.1 is explicit that the server is not a runtime — the alternative
     * would be simulating the story to list it.
     */
    linkedPassageIds: string[];
    /** Line number of the passage's declaration, for `POST …/open`. */
    line: number;
};

export type TLocationSummary = TSourced & {
    id: string;
    name: string;
    description: string;
    localCharacterCount: number;
    /** The polygon on the map, when the author has drawn one (§4.2). */
    shape: {
        mapId: string;
        points: TPolygon;
        color: string;
        z?: number;
    } | null;
};

export type TMapSummary = TSourced & {
    id: string;
    title: string;
    size: TSize;
    background: { asset: string; position: TPoint; size: TSize } | null;
    notes: { id: string; text: string; position: TPoint; rotation?: number; color?: string }[];
    strokes: { id: string; color: string; width: number; points: number[] }[];
    nestedMaps: { mapId: string; position: TPoint }[];
    /** Locations drawn on this map. Denormalised so the map tab is one request, not N+1. */
    locationIds: string[];
};

export type TCharacterSummary = TSourced & {
    id: string;
    name: string;
    kind: 'character' | 'sideCharacter';
    startPassageId: string | null;
};

export type TTriggerSummary = {
    id: string;
    chapterId: string;
    title: string | null;
    /** Seconds since the story epoch. */
    time: number | null;
};

/** `GET /api/story` — everything the client needs at boot, in one round trip (§5.3). */
export type TStoryIndex = {
    chapters: TChapterSummary[];
    passages: TPassageSummary[];
    locations: TLocationSummary[];
    maps: TMapSummary[];
    characters: TCharacterSummary[];
    triggers: TTriggerSummary[];
};

/** The uniform error envelope: every 4xx is `{ success: false, error }` (§5.3). */
export type TErrorBody = {
    success: false;
    error: string;
};
