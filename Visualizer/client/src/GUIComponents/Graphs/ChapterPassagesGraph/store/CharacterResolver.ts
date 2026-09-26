import { displayText } from '../../../../api';
import { sampleSeed } from './sampleStory';

type TCharacterType = 'main' | 'npc';

type TCharacterInfo = {
    id: string;
    name: string;
    type: TCharacterType;
    description?: string;
};

/**
 * Legacy lookup behind the old passage form's character picker. Reads the sample story
 * (`sampleStory.ts`), not `@story/data`; replaced by `api.getProject()` / `api.listEntities` in WP6.
 */
export class CharacterResolver {
    static getAllCharacters(): TCharacterInfo[] {
        return [
            ...sampleSeed.characters.map((c) => ({
                id: c.id,
                name: displayText(c.name, c.id),
                type: 'main' as const,
                description: displayText(c.description, ''),
            })),
            ...sampleSeed.npcs.map((c) => ({
                id: c.id,
                name: displayText(c.name, c.id),
                type: 'npc' as const,
                description: displayText(c.description, ''),
            })),
        ];
    }
}
