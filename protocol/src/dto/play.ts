import type { TVersioned } from './common';
import type { TStoryDto } from './story';

/** Story-relative; also the URL of the image relative to a standalone export. */
export const LANDING_IMAGE_FILE = 'data/assets/landing.png';

/**
 * What a player needs to load a story: served by `getPlayManifest`, and written as `play.json` by the
 * standalone export, so both sources read one format. Never carries the password.
 */
export type TPlayManifestDto = Pick<TStoryDto, 'id' | 'name' | 'author' | 'description'> &
    TVersioned & {
        /** `LANDING_IMAGE_FILE` exists. */
        hasLandingImage: boolean;
        /** Story-relative `/` paths, sorted: every `.ts` and `.png` below `data/` and `types/`. */
        files: string[];
    };
