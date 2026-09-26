import type { TVersion } from './common';

/**
 * Change notices on `GET /api/events` (Server-Sent Events, plan §3 "Live refresh" point 2).
 *
 * Each SSE message is `event: change` with a JSON `TChangeEvent` as `data`. One server operation
 * (a whole multi-file write) produces exactly one event; hand edits are batched over ~150 ms and
 * deduplicated per resource.
 */
export const RESOURCE_KINDS = ['chapter', 'passage', 'trigger', 'entity', 'map', 'layout', 'project'] as const;
export type TResourceKind = (typeof RESOURCE_KINDS)[number];

/** The SSE `event:` names the server sends. */
export const SSE_EVENT = {
    /** A `TChangeEvent`. */
    change: 'change',
    /** Sent once on connect; `data` is `THelloEvent`. */
    hello: 'hello',
} as const;

/**
 * `id` per kind:
 *  - `chapter`  — chapter id (`village`)
 *  - `passage`  — full passage id (`village-thomas-intro`)
 *  - `trigger`  — trigger id, or `*` when a hand edit of `triggers.ts` cannot be narrowed
 *                 (then `chapterId` is set)
 *  - `entity`   — `<kind>/<id>` (`characters/thomas`), or `items/*` for an edit of an items file
 *  - `map`      — map id (`global`)
 *  - `layout`   — `timeline` or `chapters/<chapterId>`
 *  - `project`  — `project`: `register.ts`, `TWorldState.ts` or anything under `types/`
 *
 * An id ending in `*` is a wildcard: refetch everything of that kind (in `chapterId`, if given).
 */
export type TChangeEvent = {
    kind: TResourceKind;
    id: string;
    /** The resource's version after the change; `null` when it was deleted. */
    version: TVersion | null;
    /** What happened, when the server knows (its own writes always say). */
    op?: 'created' | 'updated' | 'deleted';
    /** Scope of a wildcard id, or the owning chapter of a passage / trigger / chapter layout. */
    chapterId?: string;
};

export type THelloEvent = { connectedAt: string };

/** Helpers for building / parsing the composite ids above. */
export const eventIds = {
    entity: (kind: string, id: string) => `${kind}/${id}`,
    chapterLayout: (chapterId: string) => `chapters/${chapterId}`,
    timelineLayout: 'timeline',
    project: 'project',
    wildcard: '*',
} as const;

export const isWildcardId = (id: string) => id === '*' || id.endsWith('/*');
