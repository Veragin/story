import { fieldTypeNames, refNameOfIdType, type TStructTypeDto } from '@story/visualizer-protocol';

const FOLDER_NOUNS: Record<string, [string, string]> = {
    'data/characters/': ['character', 'characters'],
    'data/npcs/': ['NPC', 'NPCs'],
    'data/locations/': ['location', 'locations'],
    'data/items/': ['item file', 'item files'],
    'data/catalogs/': ['catalog', 'catalogs'],
    'data/chapters/': ['chapter file', 'chapter files'],
};

const nounOf = (file: string): [string, string] =>
    Object.entries(FOLDER_NOUNS).find(([folder]) => file.startsWith(folder))?.[1] ?? ['file', 'files'];

export const touchedSummary = (files: readonly string[]): string | null => {
    if (files.length === 0) return null;
    const counts = new Map<string, { count: number; noun: [string, string] }>();
    for (const file of files) {
        const noun = nounOf(file);
        const entry = counts.get(noun[1]) ?? { count: 0, noun };
        counts.set(noun[1], { ...entry, count: entry.count + 1 });
    }
    const parts = [...counts.values()].map(({ count, noun }) => `${count} ${count === 1 ? noun[0] : noun[1]}`);
    return _('Updated %s', parts.join(', '));
};

export const usagesOf = (types: readonly TStructTypeDto[], name: string): string[] =>
    types.flatMap((type) =>
        type.fields
            .filter((field) =>
                fieldTypeNames([field]).some((typeName) => typeName === name || refNameOfIdType(typeName) === name)
            )
            .map((field) => `${type.name}.${field.key}`)
    );

const SIBILANT_RE = /(s|x|z|ch|sh)$/;
const CONSONANT_Y_RE = /[^aeiou]y$/;

export const catalogNameOf = (typeName: string): string => {
    const base = typeName.replace(/^T/, '');
    const word = base.charAt(0).toLowerCase() + base.slice(1);
    if (word === '') return '';
    if (CONSONANT_Y_RE.test(word)) return `${word.slice(0, -1)}ies`;
    if (SIBILANT_RE.test(word)) return `${word}es`;
    return `${word}s`;
};
