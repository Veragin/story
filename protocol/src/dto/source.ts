import type { TVersion, TVersionedBody } from './common';

/** Only these owners' `.ts` files under `data/` are reachable, by id, never by path. */
export const SOURCE_OWNERS = ['chapter', 'passage'] as const;
export type TSourceOwner = (typeof SOURCE_OWNERS)[number];

export const isSourceOwner = (value: string): value is TSourceOwner =>
    (SOURCE_OWNERS as readonly string[]).includes(value);

export type TSourceDto = {
    /** Story-relative path. */
    file: string;
    text: string;
    /** For a passage, the same as `TPassageDto.version`. */
    version: TVersion;
};

/** The server formats the text with prettier and type-checks it before writing. */
export type TUpdateSourceBody = TVersionedBody & { text: string };
