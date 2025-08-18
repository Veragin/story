import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { TChapterPassage } from 'types/TPassage';
import { register, TRegisterPassageId } from 'data/register';

export class PassageResolver {
    private static passageCache = new Map<TRegisterPassageId, any>();

    /**
     * Resolves and returns a specific passage by chapter and passage ID
     */
    static async getPassage<T extends TRegisterPassageId>(
        chapterId: T,
        passageId: string,
        worldState: TWorldState,
        engine: Engine
    ): Promise<TChapterPassage<T>> {
        // Check cache first
        if (!this.passageCache.has(chapterId)) {
            const passages = await register.passages[chapterId]();
            this.passageCache.set(chapterId, passages.default || passages);
        }

        const chapterPassages = this.passageCache.get(chapterId);
        const passageFunction = chapterPassages[passageId];

        if (!passageFunction) {
            throw new Error(`Passage '${passageId}' not found in chapter '${chapterId}'`);
        }

        return passageFunction(worldState, engine);
    }

    /**
     * Preloads all passages for an chapter (useful for performance)
     */
    static async preloadChapterPassages<T extends TRegisterPassageId>(chapterId: T): Promise<void> {
        if (!this.passageCache.has(chapterId)) {
            const passages = await register.passages[chapterId]();
            this.passageCache.set(chapterId, passages.default || passages);
        }
    }

    /**
     * Gets all available passage IDs for a specific chapter
     */
    static async getAvailablePassageIds<T extends TRegisterPassageId>(
        chapterId: T
    ): Promise<string[]> {
        if (!this.passageCache.has(chapterId)) {
            await this.preloadChapterPassages(chapterId);
        }
        
        const chapterPassages = this.passageCache.get(chapterId);
        return Object.keys(chapterPassages);
    }

    /**
     * Clears the passage cache (useful for hot reloading in development)
     */
    static clearCache(): void {
        this.passageCache.clear();
    }
}