import type { TVersion, TVersionedBody } from './common';

/**
 * The in-app source editor (multiple stories, phase 8; it replaced "open in editor"): the whole
 * `.ts` file of a chapter or a passage, as text.
 *
 *  - `chapter` `<ch>`                → `data/chapters/<ch>/<ch>.chapter.ts`
 *  - `passage` `<ch>-<char>-<local>` → its file in `data/chapters/<ch>/<char>.passages/`
 *
 * Only `.ts` files under the story's `data/` can be reached, and only through an owner and its
 * id, never by a path.
 */
export const SOURCE_OWNERS = ['chapter', 'passage'] as const;
export type TSourceOwner = (typeof SOURCE_OWNERS)[number];

export const isSourceOwner = (value: string): value is TSourceOwner =>
    (SOURCE_OWNERS as readonly string[]).includes(value);

/** `GET /source/:owner/:id`. */
export type TSourceDto = {
    /** Story-relative path (`data/chapters/village/thomas.passages/intro.ts`). */
    file: string;
    text: string;
    /** Content hash of `text` (for a passage, the same as `TPassageDto.version`). */
    version: TVersion;
};

/**
 * `PUT /source/:owner/:id`: replace the whole file. The server formats it with prettier and
 * type-checks the story in memory first: new type errors are `422 invalid` (diagnostics by
 * `line` / `column`), a `version` that is not the one on disk is `409 stale` (`current` is the
 * fresh `TSourceDto`), and nothing is written in either case.
 */
export type TUpdateSourceBody = TVersionedBody & { text: string };
