import { register } from 'data/register';
import { TChapterId } from 'types/TIds';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { TChapterPassage } from 'types/TPassage';

export class PassageService {
    private static loadedModules: Map<TChapterId, any> = new Map();

    /**
     * Pre-loads a passage module for an chapter
     */
    static async preloadPassageModule(chapterId: TChapterId): Promise<void> {
        if (this.loadedModules.has(chapterId)) {
            return; // Already loaded
        }

        const passageLoader = register.passages[chapterId];
        if (!passageLoader) {
            throw new Error(`No passage loader found for chapter: ${chapterId}`);
        }

        const module = await passageLoader();
        this.loadedModules.set(chapterId, module.default);
    }

    /**
     * Gets a specific passage by calling the passage function with required parameters
     */
    static async getPassage(
        chapterId: TChapterId,
        passageId: string,
        worldState: TWorldState,
        engine: Engine
    ): Promise<TChapterPassage<TChapterId>> {
        // Ensure module is loaded
        await this.preloadPassageModule(chapterId);
        
        const passageModule = this.loadedModules.get(chapterId);
        if (!passageModule) {
            throw new Error(`Passage module not loaded for chapter: ${chapterId}`);
        }

        const passageFunction = passageModule[passageId];
        if (!passageFunction) {
            throw new Error(`Passage ${passageId} not found in ${chapterId} module`);
        }

        return passageFunction(worldState, engine);
    }

    /**
     * Clears loaded modules cache
     */
    static clearCache(chapterId?: TChapterId): void {
        if (chapterId) {
            this.loadedModules.delete(chapterId);
        } else {
            this.loadedModules.clear();
        }
    }
}