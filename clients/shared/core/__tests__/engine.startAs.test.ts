import { describe, expect, it } from 'vitest';
import { playableCharacters } from '@story/core';
import { register } from '@story/data';
import { keysOf } from '@story/shared';
import { newSession, newState, waitForPassage } from './support/engine';

describe('playableCharacters', () => {
    it('lists the characters that have a startPassageId', () => {
        expect(playableCharacters(register).sort()).toEqual(['annie', 'thomas']);
    });

    it('leaves out a character without a startPassageId', () => {
        const { annie, thomas } = register.characters;
        const characters = { annie: { ...annie, startPassageId: undefined }, thomas };

        expect(playableCharacters({ characters })).toEqual(['thomas']);
    });
});

describe('main character', () => {
    it('defaults to the first registered character', () => {
        expect(newState().mainCharacterId).toBe(keysOf(register.characters)[0]);
    });

    it('runs the picked character and auto-plays the other one', async () => {
        const { s, e } = newSession();

        await e.startAs('annie');
        const intro = await waitForPassage(e, 'kingdom-annie-intro');

        expect(s.mainCharacterId).toBe('annie');
        expect(intro.characterId).toBe('annie');
        expect(e.history.data.thomas!.length).toBeGreaterThan(1);
    });

    it('resolves the default character"s first turn when started as them', async () => {
        const { e } = newSession();

        await e.startAs('thomas');

        expect(e.store.passage?.id).toBe('intro');
        expect(e.store.passage?.characterId).toBe('thomas');
    });

    it('keeps the saved character when continuing from a save', async () => {
        const first = newSession();
        await first.e.startAs('annie');
        await waitForPassage(first.e, 'kingdom-annie-intro');
        first.e.saveStateToLocalStorage();

        const second = newSession();
        expect(second.s.mainCharacterId).toBe('annie');

        await second.e.handleAutoStart();
        expect(second.e.store.passage?.characterId).toBe('annie');
    });
});

describe('Engine.hasSave', () => {
    it('reports whether a save exists for the story', async () => {
        const { e } = newSession();
        expect(e.hasSave()).toBe(false);

        await e.startAs('thomas');
        e.saveStateToLocalStorage();
        expect(e.hasSave()).toBe(true);

        e.clearStateFromLocalStorage();
        expect(e.hasSave()).toBe(false);
    });
});
