// worldState/WorldStateManager.ts
import { TWorldState } from 'data/TWorldState';
import { TCharacterId, TEventId, TSideCharacterId } from 'types/TIds';
import { TLocationId } from 'types/TLocation';
import { register } from 'data/register';
import { itemInfo } from 'data/items/itemInfo';

export class WorldStateCopy {
    private readonly readOnlyState: TWorldState;

    constructor() {
        this.readOnlyState = this.createBaseState();
        // Freeze the state to prevent accidental modifications
        Object.freeze(this.readOnlyState);
    }

    /**
     * Gets the read-only reference state for passages
     * @returns Reference to the immutable base world state
     */
    getReadOnlyState(): TWorldState {
        return this.readOnlyState;
    }

    /**
     * Creates the initial base state with all required properties
     * @returns The initialized base state
     */
    private createBaseState(): TWorldState {
        // Create initial state structure
        const baseState = {
            time: register.events.village.timeRange.start,
            mainCharacterId: 'thomas',
            currentHistory: {},
            characters: {} as Record<TCharacterId, unknown>,
            sideCharacters: {} as Record<TSideCharacterId, unknown>,
            events: {} as Record<TEventId, unknown>,
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

        // Initialize events
        (Object.keys(register.events) as TEventId[]).forEach((id) => {
            baseState.events[id] = { 
                ...register.events[id].init, 
                ref: register.events[id] 
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
export const worldStateCopy = new WorldStateCopy();