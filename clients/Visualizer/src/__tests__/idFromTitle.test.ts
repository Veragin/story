import { describe, expect, it } from 'vitest';
import { idFromTitle } from '../idFromTitle';

const ID_RE = /^[a-z][A-Za-z0-9_]*$/;

describe('idFromTitle', () => {
    it('turns a title into lowerCamelCase', () => {
        expect(idFromTitle('Old Mill Road', 'location')).toBe('oldMillRoad');
        expect(idFromTitle('  the HQ-tower 2 ', 'location')).toBe('theHqTower2');
        expect(idFromTitle("Bob's   first_day!", 'passage')).toBe('bobsFirstDay');
    });

    it('strips diacritics', () => {
        expect(idFromTitle('Příběh začíná', 'chapter')).toBe('pribehZacina');
        expect(idFromTitle('Žluťoučký kůň úpěl ďábelské ódy', 'x')).toBe('zlutouckyKunUpelDabelskeOdy');
    });

    it('keeps camelCase word boundaries already in the title', () => {
        expect(idFromTitle('oldMill', 'location')).toBe('oldMill');
        expect(idFromTitle('iPhone case', 'item')).toBe('iPhoneCase');
    });

    it('prefixes the fallback when the title starts with a digit', () => {
        expect(idFromTitle('2 days later', 'chapter')).toBe('chapter2DaysLater');
        expect(idFromTitle('1984', 'chapter')).toBe('chapter1984');
    });

    it('uses the fallback when nothing usable is left', () => {
        expect(idFromTitle('', 'passage')).toBe('passage');
        expect(idFromTitle('?! …', 'passage')).toBe('passage');
        expect(idFromTitle('日本', 'passage')).toBe('passage');
    });

    it('appends a number until the id is free', () => {
        const taken = new Set(['intro', 'intro2', 'passage']);
        const isTaken = (id: string) => taken.has(id);
        expect(idFromTitle('Intro', 'passage', isTaken)).toBe('intro3');
        expect(idFromTitle('Outro', 'passage', isTaken)).toBe('outro');
        expect(idFromTitle('', 'passage', isTaken)).toBe('passage2');
    });

    it('always yields an id the server accepts', () => {
        for (const title of ['Old Mill', '42', '_x_', '-a-b-', 'Ärger', 'ÀÉÎÕÜ ß ø']) {
            expect(idFromTitle(title, 'id')).toMatch(ID_RE);
        }
    });
});
