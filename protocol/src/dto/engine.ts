import type { TVersion, TVersionedBody } from './common';

/** The story's engine settings, one file each under `data/engine/`. */
export const ENGINE_SECTIONS = ['onLinkClick', 'topbar'] as const;
export type TEngineSection = (typeof ENGINE_SECTIONS)[number];

export const isEngineSection = (value: string): value is TEngineSection =>
    (ENGINE_SECTIONS as readonly string[]).includes(value);

export type TEngineSectionDto = {
    section: TEngineSection;
    /** Story-relative path, also while the file does not exist. */
    file: string;
    exists: boolean;
    /** `false` for a missing file or the stub written for a description without code. */
    implemented: boolean;
    /** `''` while the file does not exist. */
    version: TVersion;
    /** The JSDoc of the primary export (`onLinkClick`, `Topbar`) without the markers. */
    description: string;
    /** The whole file without that JSDoc. */
    code: string;
};

/**
 * `description` and `code` are each optional: the one left out keeps its current value (or the stub
 * code for a new file). The server formats the file and type-checks it before writing.
 */
export type TUpdateEngineSectionBody =
    | (TVersionedBody & { description?: string; code?: string })
    | (TVersionedBody & { delete: true });
