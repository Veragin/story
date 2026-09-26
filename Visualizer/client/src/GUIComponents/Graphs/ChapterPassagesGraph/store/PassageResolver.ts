import type { TPassageDto } from '@story/visualizer-protocol';
import { mockApi } from '../../../../api';

/**
 * Legacy passage lookup for the passage graph and the old passage form. It used to import and
 * *run* the story's passage functions from `@story/data`; it now reads `mockApi` (plan WP1:
 * "move the graph's passage loading onto mockApi"). WP6 replaces it with the real `api`.
 */
export class PassageResolver {
    static getPassage(passageId: string): Promise<TPassageDto> {
        return mockApi.getPassage(passageId);
    }

    /** Full passage ids (`village-thomas-intro`) of a chapter. */
    static async getAvailablePassageIds(chapterId: string): Promise<string[]> {
        const { passages } = await mockApi.listChapterPassages(chapterId);
        return passages.map((p) => p.passageId);
    }
}
