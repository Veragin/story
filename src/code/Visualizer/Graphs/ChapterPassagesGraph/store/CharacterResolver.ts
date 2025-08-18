import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { register } from 'data/register';

type TCharacterType = 'main' | 'side';

interface TCharacterInfo {
    id: string;
    name: string;
    type: TCharacterType;
    character: any;
    description?: string;
}

export class CharacterResolver {
    private static characterCache = new Map<string, any>();
    private static characterListCache: TCharacterInfo[] | null = null;

    /**
     * Resolves and returns a specific character by ID
     */
    static getCharacter(
        characterId: string,
        worldState?: TWorldState,
        engine?: Engine
    ): any {
        // Check main characters first
        if (register.characters[characterId as keyof typeof register.characters]) {
            const character = register.characters[characterId as keyof typeof register.characters];
            this.characterCache.set(characterId, character);
            return character;
        }

        // Check side characters
        if (register.sideCharacters[characterId as keyof typeof register.sideCharacters]) {
            const character = register.sideCharacters[characterId as keyof typeof register.sideCharacters];
            this.characterCache.set(characterId, character);
            return character;
        }

        // Check cache as fallback
        if (this.characterCache.has(characterId)) {
            return this.characterCache.get(characterId);
        }

        throw new Error(`Character '${characterId}' not found`);
    }

    /**
     * Gets all available characters with their metadata
     */
    static getAllCharacters(): TCharacterInfo[] {
        if (this.characterListCache) {
            return this.characterListCache;
        }

        const characters: TCharacterInfo[] = [];

        // Add main characters
        Object.keys(register.characters).forEach(key => {
            const character = register.characters[key as keyof typeof register.characters];
            characters.push({
                id: key,
                name: character.name || key,
                type: 'main',
                character: character,
                description: character.description || ''
            });
        });

        // Add side characters
        Object.keys(register.sideCharacters).forEach(key => {
            const character = register.sideCharacters[key as keyof typeof register.sideCharacters];
            characters.push({
                id: key,
                name: character.name || key,
                type: 'side',
                character: character,
                description: character.description || ''
            });
        });

        this.characterListCache = characters;
        return characters;
    }

    /**
     * Gets all available character IDs
     */
    static getAvailableCharacterIds(): string[] {
        const mainCharacterIds = Object.keys(register.characters);
        const sideCharacterIds = Object.keys(register.sideCharacters);
        return [...mainCharacterIds, ...sideCharacterIds];
    }

    /**
     * Gets only main characters
     */
    static getMainCharacters(): TCharacterInfo[] {
        return this.getAllCharacters().filter(char => char.type === 'main');
    }

    /**
     * Gets only side characters
     */
    static getSideCharacters(): TCharacterInfo[] {
        return this.getAllCharacters().filter(char => char.type === 'side');
    }

    /**
     * Gets main character IDs only
     */
    static getMainCharacterIds(): string[] {
        return Object.keys(register.characters);
    }

    /**
     * Gets side character IDs only
     */
    static getSideCharacterIds(): string[] {
        return Object.keys(register.sideCharacters);
    }

    /**
     * Checks if a character exists
     */
    static characterExists(characterId: string): boolean {
        return (
            register.characters[characterId as keyof typeof register.characters] !== undefined ||
            register.sideCharacters[characterId as keyof typeof register.sideCharacters] !== undefined
        );
    }

    /**
     * Gets character type (main or side)
     */
    static getCharacterType(characterId: string): TCharacterType | null {
        if (register.characters[characterId as keyof typeof register.characters]) {
            return 'main';
        }
        if (register.sideCharacters[characterId as keyof typeof register.sideCharacters]) {
            return 'side';
        }
        return null;
    }

    /**
     * Gets character info by ID
     */
    static getCharacterInfo(characterId: string): TCharacterInfo | null {
        const allCharacters = this.getAllCharacters();
        return allCharacters.find(char => char.id === characterId) || null;
    }

    /**
     * Searches characters by name (case-insensitive)
     */
    static searchCharactersByName(searchTerm: string): TCharacterInfo[] {
        const allCharacters = this.getAllCharacters();
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        return allCharacters.filter(char => 
            char.name.toLowerCase().includes(lowerSearchTerm) ||
            char.id.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * Gets characters formatted for dropdown/select components
     */
    static getCharactersForSelect(): Array<{ value: string; label: string; type: TCharacterType }> {
        return this.getAllCharacters().map(char => ({
            value: char.id,
            label: char.name,
            type: char.type
        }));
    }

    /**
     * Preloads all characters (useful for performance)
     */
    static preloadAllCharacters(): void {
        const allCharacters = this.getAllCharacters();
        allCharacters.forEach(char => {
            this.characterCache.set(char.id, char.character);
        });
    }

    /**
     * Clears the character cache (useful for hot reloading in development)
     */
    static clearCache(): void {
        this.characterCache.clear();
        this.characterListCache = null;
    }

    /**
     * Gets character statistics
     */
    static getCharacterStats(): {
        totalCharacters: number;
        mainCharacters: number;
        sideCharacters: number;
    } {
        const allCharacters = this.getAllCharacters();
        return {
            totalCharacters: allCharacters.length,
            mainCharacters: allCharacters.filter(char => char.type === 'main').length,
            sideCharacters: allCharacters.filter(char => char.type === 'side').length,
        };
    }
}