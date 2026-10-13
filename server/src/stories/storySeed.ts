import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../config/env';
import { parseStoryFile, type TStoryFile } from './storyFile';

// a seed story's folder holds only its content; its metadata waits here until the database has a row
export const STORY_SEED_ROOT = path.join(REPO_ROOT, 'server', 'seed');

export type TStorySeed = { dir: string; file: TStoryFile };

export const storySeedId = (seed: Pick<TStorySeed, 'dir'>) => path.basename(seed.dir);

export const storySeedFile = (dir: string) => path.join(STORY_SEED_ROOT, `${path.basename(dir)}.story.json`);

export const readStorySeed = async (dir: string): Promise<TStorySeed> => ({
    dir,
    file: parseStoryFile(JSON.parse(await readFile(storySeedFile(dir), 'utf8'))),
});
