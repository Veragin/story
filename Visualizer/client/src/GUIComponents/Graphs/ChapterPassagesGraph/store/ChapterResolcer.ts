import type { TChapterId } from '@story/types';
import { sampleSeed } from './sampleStory';

/**
 * Legacy lookup behind the old chapter / passage forms. Reads the sample story (`sampleStory.ts`),
 * not `@story/data`; replaced by `api.getProject()` in WP5 / WP6.
 */
export class ChapterResolver {
    static getAvailableChapterIds(): TChapterId[] {
        return sampleSeed.chapters.map((c) => c.chapterId as TChapterId);
    }
}
