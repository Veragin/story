/**
 * The passage-id *format*.
 *
 * A passage is addressed by `<chapter>-<character>-<passage>`. That encoding is engine
 * machinery — `core/parsePassageId` and `History` are what read it back apart — so it lives
 * here rather than in the author-edited `types/`.
 *
 * What stays in `types/ids.ts` is the half that cannot exist below `data/`: `TChapterId` and
 * `TCharacterId` are `keyof TWorldState[...]`, i.e. derived from the author's own story, and
 * `shared` is the bottom of the layering and may not import any other `@story` package.
 * So the shape is generic here and `types/ids.ts` binds it to the real id unions.
 */

/** Any passage id, with neither part narrowed — the erased form used to pass ids around. */
export type TPassageId = `${string}-${string}-${string}`;

/** A passage id narrowed to a chapter `E` and a character `Ch`. */
export type TPassageIdFor<E extends string, Ch extends string> = `${E}-${Ch}-${string}`;
