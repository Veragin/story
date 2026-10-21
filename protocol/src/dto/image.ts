import type { TVersion, TVersionedBody } from './common';

/**
 * An owner's image is the `.png` next to its `.ts` file, same basename. PNG only. The `story` owner has one image,
 * `STORY_LANDING_IMAGE_ID`, at `LANDING_IMAGE_FILE`.
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
    /** Where the `.png` is or an upload would go. */
    file: string;
    /** `''` when there is no image. */
    version: TVersion;
    /** Cache-busted by `version`; `null` when there is no image. */
    url: string | null;
};

/** `version: ''` when there is no image yet. */
export type TUploadImageBody = TVersionedBody & {
    /** Base64, no `data:` prefix. */
    data: string;
};

/** `version` is the image's current one. */
export type TDeleteImageBody = TVersionedBody;

/** Its base64 still fits the server's JSON body limit. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
