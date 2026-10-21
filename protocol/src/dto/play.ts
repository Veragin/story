import type { TVersioned } from './common';
import type { TStoryDto } from './story';

/** Story-relative; also the URL of the image relative to a standalone export. */
export const LANDING_IMAGE_FILE = 'data/assets/landing.png';

/** The manifest's file name in a standalone export, next to its `index.html`. */
export const PLAY_MANIFEST_FILE = 'play.json';

/**
 * What a player needs to load a story: served by `getPlayManifest`, and written as `PLAY_MANIFEST_FILE` by the
 * standalone export, so both sources read one format. Never carries the password.
 */
export type TPlayManifestDto = Pick<TStoryDto, 'id' | 'name' | 'author' | 'description'> &
    TVersioned & {
        /** `LANDING_IMAGE_FILE` exists. */
        hasLandingImage: boolean;
        /** Story-relative `/` paths, sorted: every `.ts` and `.png` below `data/` and `types/`. */
        files: string[];
    };
