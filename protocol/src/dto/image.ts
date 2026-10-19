import type { TVersion, TVersionedBody } from './common';

/** An owner's image is the `.png` next to its `.ts` file, same basename. PNG only. */
export const IMAGE_OWNERS = ['passages', 'characters', 'npcs'] as const;
export type TImageOwner = (typeof IMAGE_OWNERS)[number];

export const isImageOwner = (value: string): value is TImageOwner =>
    (IMAGE_OWNERS as readonly string[]).includes(value);

export type TImageDto = {
    owner: TImageOwner;
    /** A full passage id, or a character / npc id. */
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

/** Its base64 still fits the server's JSON body limit. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
