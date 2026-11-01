import type { TVersion, TVersionedBody } from './common';

/**
 * An owner's image is the `.webp` or `.png` next to its `.ts` file, same basename; `.webp` wins when both exist. The
 * `story` owner has one image, `STORY_LANDING_IMAGE_ID`, at `LANDING_WEBP_FILE` or `LANDING_IMAGE_FILE`.
 */
export const IMAGE_OWNERS = ['passages', 'characters', 'npcs', 'story'] as const;
export type TImageOwner = (typeof IMAGE_OWNERS)[number];

export const isImageOwner = (value: string): value is TImageOwner =>
    (IMAGE_OWNERS as readonly string[]).includes(value);

/** The id of the `story` owner's only image. */
export const STORY_LANDING_IMAGE_ID = 'landing';

export type TImageDto = {
    owner: TImageOwner;
    /** A full passage id, a character / npc id, or `STORY_LANDING_IMAGE_ID`. */
    id: string;
    /** Where the image is; the `.png` path when there is none. */
    file: string;
    /** `''` when there is no image. */
    version: TVersion;
    /** Cache-busted by `version`; `null` when there is no image. */
    url: string | null;
};

/** `version: ''` when there is no image yet. */
export type TUploadImageBody = TVersionedBody & {
    /** A PNG or WebP as base64, no `data:` prefix; it replaces the image in the other format. */
    data: string;
};

/** `version` is the image's current one. */
export type TDeleteImageBody = TVersionedBody;

/** Its base64 still fits the server's JSON body limit. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** A WebP starts with `RIFF_SIGNATURE`, a 4-byte size, then `WEBP_SIGNATURE`. */
export const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const;
export const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;
