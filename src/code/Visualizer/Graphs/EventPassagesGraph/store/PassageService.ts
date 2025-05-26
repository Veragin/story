import { register } from 'data/register';
import { TEventId } from 'types/TIds';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { TEventPassage } from 'types/TPassage';

export class PassageService {
    private static loadedModules: Map<TEventId, any> = new Map();

    /**
     * Pre-loads a passage module for an event
     */
    static async preloadPassageModule(eventId: TEventId): Promise<void> {
        if (this.loadedModules.has(eventId)) {
            return; // Already loaded
        }

        const passageLoader = register.passages[eventId];
        if (!passageLoader) {
            throw new Error(`No passage loader found for event: ${eventId}`);
        }

        const module = await passageLoader();
        this.loadedModules.set(eventId, module.default);
    }

    /**
     * Gets a specific passage by calling the passage function with required parameters
     */
    static async getPassage(
        eventId: TEventId,
        passageId: string,
        worldState: TWorldState,
        engine: Engine
    ): Promise<TEventPassage<TEventId>> {
        // Ensure module is loaded
        await this.preloadPassageModule(eventId);
        
        const passageModule = this.loadedModules.get(eventId);
        if (!passageModule) {
            throw new Error(`Passage module not loaded for event: ${eventId}`);
        }

        const passageFunction = passageModule[passageId];
        if (!passageFunction) {
            throw new Error(`Passage ${passageId} not found in ${eventId} module`);
        }

        return passageFunction(worldState, engine);
    }

    /**
     * Clears loaded modules cache
     */
    static clearCache(eventId?: TEventId): void {
        if (eventId) {
            this.loadedModules.delete(eventId);
        } else {
            this.loadedModules.clear();
        }
    }
}