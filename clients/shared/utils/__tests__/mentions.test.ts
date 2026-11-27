import { describe, expect, it } from 'vitest';
import {
    describeMentions,
    MENTION_CLASSES,
    parseMentions,
    startsWithMention,
    type TMentionNameOf,
} from '../src/mentions';

const NAMES: Record<string, string> = {
    'character:thomas': 'Thomas',
    'npc:herbalist': 'Old Herbalist',
    'location:village': 'Village',
    'item:apple': 'Apple',
    'chapter:village': 'In the Village',
    'passage:village-thomas-intro': 'Arrival',
};

const nameOf: TMentionNameOf = (mentionClass, id) => NAMES[`${mentionClass}:${id}`];

const mentioned = (text: string) => parseMentions(text).map(({ mentionClass, id }) => `${mentionClass}:${id}`);

describe('parseMentions', () => {
    it('finds a mention of every class, with its position', () => {
        const text = MENTION_CLASSES.map((mentionClass) =>
            mentionClass === 'passage' ? '@passage:village-thomas-intro' : `@${mentionClass}:x1`
        ).join(' and ');
        expect(mentioned(text)).toEqual([
            'character:x1',
            'npc:x1',
            'location:x1',
            'item:x1',
            'chapter:x1',
            'passage:village-thomas-intro',
        ]);
        expect(parseMentions('see @character:thomas.')).toEqual([
            { mentionClass: 'character', id: 'thomas', start: 4, end: 21 },
        ]);
    });

    it('keeps the hyphens of a passage id', () => {
        expect(mentioned('@passage:village-thomas-intro')).toEqual(['passage:village-thomas-intro']);
        expect(mentioned('@passage:village-thomas-the-old_mill-2')).toEqual(['passage:village-thomas-the-old_mill-2']);
        expect(mentioned('@passage:village-thomas')).toEqual([]);
    });

    it('leaves trailing punctuation out of the id', () => {
        expect(mentioned('@passage:village-thomas-intro. Then @character:thomas, @npc:herbalist!')).toEqual([
            'passage:village-thomas-intro',
            'character:thomas',
            'npc:herbalist',
        ]);
        expect(mentioned("(@location:village) @passage:village-thomas-intro-, @item:apple's")).toEqual([
            'location:village',
            'passage:village-thomas-intro',
            'item:apple',
        ]);
        expect(mentioned('@character:thomas-and-anna')).toEqual(['character:thomas']);
    });

    it('ignores unknown classes, bad ids and plain @', () => {
        expect(
            mentioned('@monster:troll @character:Thomas @character: @ x @../thomas.png @characters/thomas.png')
        ).toEqual([]);
        expect(mentioned('@passage:Village-thomas-intro')).toEqual([]);
    });
});

describe('describeMentions', () => {
    it('replaces each mention with its name', () => {
        expect(describeMentions('@character:thomas standing in @location:village.', nameOf)).toBe(
            'Thomas standing in Village.'
        );
        expect(
            describeMentions('@npc:herbalist, @item:apple, @chapter:village, @passage:village-thomas-intro', nameOf)
        ).toBe('Old Herbalist, Apple, In the Village, Arrival');
    });

    it('falls back to the id of an unknown entity', () => {
        expect(describeMentions('@character:anna meets @character:thomas', nameOf)).toBe('anna meets Thomas');
        expect(describeMentions('@passage:village-anna-intro!', () => undefined)).toBe('village-anna-intro!');
    });

    it('leaves text without mentions as it is', () => {
        expect(describeMentions('', nameOf)).toBe('');
        expect(describeMentions('a quiet square, email@example.com', nameOf)).toBe('a quiet square, email@example.com');
    });
});

describe('startsWithMention', () => {
    it('is true only for @<class>: at the start', () => {
        expect(MENTION_CLASSES.every((mentionClass) => startsWithMention(`@${mentionClass}:`))).toBe(true);
        expect(startsWithMention('@character:thomas waves')).toBe(true);
        expect(startsWithMention('x @character:thomas')).toBe(false);
        expect(startsWithMention('@characters/thomas.png')).toBe(false);
        expect(startsWithMention('@monster:troll')).toBe(false);
    });
});
