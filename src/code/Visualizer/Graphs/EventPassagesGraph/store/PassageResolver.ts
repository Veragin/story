import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { TEventPassage } from 'types/TPassage';
import { register, TRegisterPassageId } from 'data/register';

export class PassageResolver {
    private static passageCache = new Map<TRegisterPassageId, any>();

    /**
     * Resolves and returns a specific passage by event and passage ID
     */
    static async getPassage<T extends TRegisterPassageId>(
        eventId: T,
        passageId: string,
        worldState: TWorldState,
        engine: Engine
    ): Promise<TEventPassage<T>> {
        // Check cache first
        if (!this.passageCache.has(eventId)) {
            const passages = await register.passages[eventId]();
            this.passageCache.set(eventId, passages.default || passages);
        }

        const eventPassages = this.passageCache.get(eventId);
        const passageFunction = eventPassages[passageId];

        if (!passageFunction) {
            throw new Error(`Passage '${passageId}' not found in event '${eventId}'`);
        }

        return passageFunction(worldState, engine);
    }

    /**
     * Preloads all passages for an event (useful for performance)
     */
    static async preloadEventPassages<T extends TRegisterPassageId>(eventId: T): Promise<void> {
        if (!this.passageCache.has(eventId)) {
            const passages = await register.passages[eventId]();
            this.passageCache.set(eventId, passages.default || passages);
        }
    }

    /**
     * Gets all available passage IDs for a specific event
     */
    static async getAvailablePassageIds<T extends TRegisterPassageId>(
        eventId: T
    ): Promise<string[]> {
        if (!this.passageCache.has(eventId)) {
            await this.preloadEventPassages(eventId);
        }
        
        const eventPassages = this.passageCache.get(eventId);
        return Object.keys(eventPassages);
    }

    /**
     * Clears the passage cache (useful for hot reloading in development)
     */
    static clearCache(): void {
        this.passageCache.clear();
    }
}