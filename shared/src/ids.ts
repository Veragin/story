/** `<chapter>-<character>-<passage>`, with neither part narrowed. */
export type TPassageId = `${string}-${string}-${string}`;

export type TPassageIdFor<E extends string, Ch extends string> = `${E}-${Ch}-${string}`;
