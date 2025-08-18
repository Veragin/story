// worldState/WorldStateManager.ts
import { TWorldState } from 'data/TWorldState';
import { TCharacterId, TChapterId, TSideCharacterId } from 'types/TIds';
import { TLocationId } from 'types/TLocation';
import { register } from 'data/register';
import { itemInfo } from 'data/items/itemInfo';

class WorldStateCopy {

    /**
     * Creates the initial base state with all required properties
     * @returns The initialized base state
     */
    createBaseState(): TWorldState {
        // Create initial state structure
        const baseState = {
            time: register.chapters.village.timeRange.start,
            mainCharacterId: 'thomas',
            currentHistory: {},
            characters: {} as Record<TCharacterId, unknown>,
            sideCharacters: {} as Record<TSideCharacterId, unknown>,
            chapters: {} as Record<TChapterId, unknown>,
            locations: {} as Record<TLocationId, unknown>,
            happenings: {} as Record<string, unknown>
        };

        // Initialize characters
        (Object.keys(register.characters) as TCharacterId[]).forEach((id) => {
            const { inventory, ...rest } = register.characters[id].init;
            baseState.characters[id] = {
                ...rest,
                inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
                ref: register.characters[id],
            };
        });

        // Initialize side characters
        (Object.keys(register.sideCharacters) as TSideCharacterId[]).forEach((id) => {
            const { inventory, ...rest } = register.sideCharacters[id].init;
            baseState.sideCharacters[id] = {
                ...rest,
                inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
                ref: register.sideCharacters[id],
            };
        });

        // Initialize chapters
        (Object.keys(register.chapters) as TChapterId[]).forEach((id) => {
            baseState.chapters[id] = { 
                ...register.chapters[id].init, 
                ref: register.chapters[id] 
            };
        });

        // Initialize locations
        (Object.keys(register.locations) as TLocationId[]).forEach((id) => {
            baseState.locations[id] = { 
                ...register.locations[id].init, 
                ref: register.locations[id] 
            };
        });

        // Initialize happenings
        Object.entries(register.happenings).forEach(([id, happening]) => {
            baseState.happenings[id] = { ref: happening };
        });

        return baseState as TWorldState;
    }
}

// Create a singleton instance for easy access
export const worldStateCopy = new WorldStateCopy().createBaseState();