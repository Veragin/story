import type { TVersion } from './common';

/**
 * One SSE `change` message per server operation (a whole multi-file write); hand edits are batched
 * and deduplicated per resource.
 */
export const RESOURCE_KINDS = [
    'chapter',
    'passage',
    'trigger',
    'entity',
    'map',
    'layout',
    'project',
    'structure',
    'catalog',
] as const;
export type TResourceKind = (typeof RESOURCE_KINDS)[number];

export const SSE_EVENT = {
    /** `data` is a `TChangeEvent`. */
    change: 'change',
    /** Sent once on connect; `data` is a `THelloEvent`. */
    hello: 'hello',
} as const;

/**
 * `id` per kind:
 *  - `chapter`  — chapter id (`village`)
 *  - `passage`  — full passage id (`village-thomas-intro`)
 *  - `trigger`  — trigger id, or `*` when a hand edit of `triggers.ts` cannot be narrowed
 *  - `entity`   — `<kind>/<id>` (`characters/thomas`), or `items/*` for an edit of an items file
 *  - `map`      — map id (`global`)
 *  - `layout`   — `timeline` or `chapters/<chapterId>`
 *  - `project`  — `project`: `register.ts`, `TWorldState.ts` or anything under `types/`
 *  - `structure` — `structure`: the literals and types (`types/`, `data/items/`, `data/catalogs/`)
 *  - `catalog`  — `<catalog>/<id>` (`races/elf`), or `<catalog>/*` for an edit of a catalog file
 *
 * An id ending in `*` is a wildcard: refetch everything of that kind (in `chapterId`, if given).
 */
export type TChangeEvent = {
    kind: TResourceKind;
    id: string;
    /** `null` when deleted. */
    version: TVersion | null;
    /** Always set for the server's own writes. */
    op?: 'created' | 'updated' | 'deleted';
    /** Scope of a wildcard id, or the owning chapter of a passage / trigger / chapter layout. */
    chapterId?: string;
};

export type THelloEvent = { connectedAt: string };

export const eventIds = {
    entity: (kind: string, id: string) => `${kind}/${id}`,
    chapterLayout: (chapterId: string) => `chapters/${chapterId}`,
    timelineLayout: 'timeline',
    project: 'project',
    structure: 'structure',
    catalog: (catalog: string, id: string) => `${catalog}/${id}`,
    wildcard: '*',
} as const;
