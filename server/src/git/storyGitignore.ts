import { TMP_SUFFIX } from '../json/atomicWrite';

export const GITIGNORE_FILE = '.gitignore';

export const STORY_GITIGNORE = ['node_modules/', `*${TMP_SUFFIX}*`, '.create-*', '.import-*', '.git-setup-*', ''].join(
    '\n'
);
