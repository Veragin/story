import { describe, expect, it } from 'vitest';
import type { TProjectDto } from '@story/protocol';
import { formatMention, MENTION_CLASSES, mentionSuggestions, type TMentionSources } from '../aiMentions';

const project = (overrides: Partial<TProjectDto> = {}): TProjectDto => ({
    version: 'v1',
    chapters: [],
    characters: [
        { id: 'thomas', name: 'Thomas' },
        { id: 'anna', name: 'Anna Brave' },
    ],
    npcs: [],
    locations: [{ id: 'village', name: 'village' }],
    items: [{ id: 'apple', name: 'Apple', type: 'food' }],
    triggers: [],
    ...overrides,
});

const sources = (overrides: Partial<TMentionSources> = {}): TMentionSources => ({
    project: project(),
    passages: [],
    ...overrides,
});

const values = (query: string, from = sources()) => mentionSuggestions(query, from).matches.map((m) => m.value);

describe('aiMentions', () => {
    it('derives the classes from the entity kinds plus chapters and passages', () => {
        expect(MENTION_CLASSES.map((c) => `${c.name}→${c.kind}`)).toEqual([
            'character→characters',
            'npc→npcs',
            'location→locations',
            'item→items',
            'chapter→chapters',
            'passage→passages',
        ]);
        expect(formatMention('npc', 'herbalist')).toBe('@npc:herbalist');
    });

    it('filters the classes by prefix', () => {
        expect(values('')).toEqual([
            '@character:',
            '@npc:',
            '@location:',
            '@item:',
            '@chapter:',
            '@passage:',
        ]);
        expect(values('ch')).toEqual(['@character:', '@chapter:']);
        expect(mentionSuggestions('ch', sources()).matches.every((m) => m.continues)).toBe(true);
        expect(mentionSuggestions('ch', sources()).mentionClass).toBeNull();
        expect(values('zz')).toEqual([]);
    });

    it('filters the entries of a class by id or name, case-insensitively', () => {
        expect(values('character:')).toEqual(['@character:thomas', '@character:anna']);
        expect(values('character:TH')).toEqual(['@character:thomas']);
        expect(values('character:brave')).toEqual(['@character:anna']);
        const [apple] = mentionSuggestions('item:app', sources()).matches;
        expect(apple).toMatchObject({ label: 'apple', value: '@item:apple', continues: false });
        expect(apple.detail).toContain('food');
    });

    it('returns the whole match set without a cap', () => {
        const characters = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, name: `C${i}` }));
        expect(values('character:', sources({ project: project({ characters }) }))).toHaveLength(30);
    });

    it('knows a class without entries and rejects an unknown class', () => {
        expect(mentionSuggestions('npc:', sources())).toEqual({ mentionClass: 'npc', matches: [] });
        expect(mentionSuggestions('npc:xy', sources())).toEqual({ mentionClass: 'npc', matches: [] });
        expect(mentionSuggestions('foo:', sources())).toEqual({ mentionClass: null, matches: [] });
        expect(mentionSuggestions('character:', sources({ project: null })).mentionClass).toBe('character');
    });

    it('lists passages from the given source', () => {
        const passages = [{ id: 'village-thomas-intro', title: 'Intro', chapterId: 'village' }];
        expect(values('passage:intro', sources({ passages }))).toEqual(['@passage:village-thomas-intro']);
    });
});
