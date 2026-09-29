import type { TVersion, TVersionedBody } from './common';

/**
 * Story art (plan §2 "Data model"). An image belongs to a passage, a character or an npc and is
 * found by convention, never through a field: it is the `.png` next to the owner's `.ts` file,
 * with the same basename —
 *
 *  - passage `data/chapters/kingdom/annie.passages/palace.ts` → `…/annie.passages/palace.png`
 *  - character `data/characters/thomas.ts` → `data/characters/thomas.png`
 *  - npc `data/npcs/Franta.ts` → `data/npcs/Franta.png`
 *
 * The owner's `image` field (`TScreenPassageDto.image`, `TCharacterDto.image`, `TNpcDto.image`)
 * is only a text description of the picture. Only PNG is accepted: the server checks the PNG
 * signature and converts nothing.
 */
export const IMAGE_OWNERS = ['passages', 'characters', 'npcs'] as const;
export type TImageOwner = (typeof IMAGE_OWNERS)[number];

export const isImageOwner = (value: string): value is TImageOwner =>
    (IMAGE_OWNERS as readonly string[]).includes(value);

/** `GET /images/:owner/:id` — `id` is a full passage id, or a character / npc id. */
export type TImageDto = {
    owner: TImageOwner;
    id: string;
    /** Project-relative path of the `.png`, whether it exists or not (where an upload goes). */
    file: string;
    /** Content hash of the `.png`; `''` when there is none. */
    version: TVersion;
    /**
     * Where to load the picture from, cache-busted by `version`
     * (`/api/stories/example/images/passages/village-thomas-intro/png?v=…`), or `null` when there is none.
     */
    url: string | null;
};

/**
 * `PUT /images/:owner/:id` — create or replace the image. `version` is the one the upload is
 * based on (`''` = there is no image yet); a mismatch is 409 `stale` with the current `TImageDto`.
 */
export type TUploadImageBody = TVersionedBody & {
    /** The PNG file, base64-encoded (no `data:` prefix). */
    data: string;
};

/** Largest accepted PNG, in bytes (its base64 still fits the server's JSON body limit). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** The 8-byte PNG file signature. */
export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
