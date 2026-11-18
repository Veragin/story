import '@story/shared';
import { observable } from 'mobx';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TProjectDto } from '@story/protocol';
import { createMockApi } from '../../api';
import type { TPassageEntry } from '../aiMentions';
import { AiStore } from '../AiStore';
import { PASSAGE_SUGGESTION_LIMIT, SUGGESTION_LIMIT } from '../AiSuggestStore';
import type { TPassageIndex } from '../PassageIndex';

const PROJECT: TProjectDto = {
    version: 'v1',
    chapters: [],
    characters: [
        { id: 'thomas', name: 'Thomas' },
        { id: 'tereza', name: 'Tereza' },
        { id: 'anna', name: 'Big Tom' },
    ],
    npcs: [],
    locations: [],
    items: [],
    triggers: [],
};

const passage = (id: string): TPassageEntry => ({ id, title: id, chapterId: 'village' });

describe('AiSuggestStore', () => {
    let entities: { project: TProjectDto | null; start: () => () => void };
    let passages: TPassageIndex & { passages: TPassageEntry[]; inChapter: boolean; loading: boolean };
    let store: AiStore;

    const type = (draft: string) => store.setDraft(draft);
    const values = () => store.suggest.items.map((i) => i.value);

    beforeEach(() => {
        entities = observable({ project: PROJECT, start: () => () => {} });
        passages = observable({
            passages: [],
            loading: false,
            inChapter: false,
            load: () => {},
            attachChapter: () => () => {},
        });
        store = new AiStore({ api: createMockApi(), entities, passages });
        store.applyEvent({ type: 'status', status: 'ready' });
        store.applyEvent({ type: 'usage', credits: 10, turnCredits: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 } });
    });

    it('Tab accepts the arrow selection first', () => {
        type('/');
        store.suggest.move(1);
        store.suggest.move(1);
        store.suggest.complete();
        expect(store.draft).toBe('/resume ');
    });

    it('Tab accepts a single match whole', () => {
        type('/res');
        store.suggest.complete();
        expect(store.draft).toBe('/resume ');
        type('@pas');
        store.suggest.complete();
        expect(store.draft).toBe('@passage:');
        expect(store.suggest.open).toBe(true);
    });

    it('Tab fills in the common prefix, then the first item', () => {
        type('@ch');
        store.suggest.complete();
        expect(store.draft).toBe('@cha');
        store.suggest.complete();
        expect(store.draft).toBe('@character:');
        type('/');
        store.suggest.complete();
        expect(store.draft).toBe('/clear ');
    });

    it('computes the prefix over all matches, not only the displayed rows', () => {
        passages.passages = [
            ...Array.from({ length: PASSAGE_SUGGESTION_LIMIT }, (_, i) => passage(`village-thomas-${i}`)),
            passage('village-anna-intro'),
        ];
        type('@passage:vil');
        expect(store.suggest.items).toHaveLength(PASSAGE_SUGGESTION_LIMIT);
        store.suggest.complete();
        expect(store.draft).toBe('@passage:village-');
    });

    it('falls back to the first item when a match is found by name only', () => {
        type('@character:t');
        expect(values()).toEqual(['@character:thomas', '@character:tereza', '@character:anna']);
        store.suggest.complete();
        expect(store.draft).toBe('@character:thomas ');
    });

    it('caps the rows at 20, and passages outside a chapter at 10', () => {
        entities.project = {
            ...PROJECT,
            npcs: Array.from({ length: 30 }, (_, i) => ({ id: `npc${i}`, name: `Npc ${i}` })),
        };
        passages.passages = Array.from({ length: 30 }, (_, i) => passage(`village-thomas-${i}`));
        type('@npc:');
        expect(store.suggest.matches).toHaveLength(30);
        expect(store.suggest.items).toHaveLength(SUGGESTION_LIMIT);
        type('@passage:');
        expect(store.suggest.items).toHaveLength(PASSAGE_SUGGESTION_LIMIT);
        passages.inChapter = true;
        expect(store.suggest.items).toHaveLength(SUGGESTION_LIMIT);
    });

    it('moves the selection with wrapping and resets it when the token changes', () => {
        type('/');
        store.suggest.move(-1);
        expect(store.suggest.selected).toBe(3);
        store.suggest.move(1);
        expect(store.suggest.selected).toBe(0);
        type('/c');
        expect(store.suggest.selected).toBeNull();
    });

    it('stays open with an empty list for a known class and closes for an unknown one', () => {
        type('@npc:');
        expect(store.suggest.open).toBe(true);
        expect(store.suggest.items).toEqual([]);
        type('@npc:xy');
        expect(store.suggest.open).toBe(true);
        type('@foo:');
        expect(store.suggest.open).toBe(false);
        type('@zz');
        expect(store.suggest.open).toBe(false);
    });

    it('stays closed until the token changes after a dismiss, and while locked', () => {
        type('@');
        store.suggest.dismiss();
        expect(store.suggest.open).toBe(false);
        type('@c');
        expect(store.suggest.open).toBe(true);
        store.applyEvent({ type: 'status', status: 'busy' });
        expect(store.suggest.open).toBe(false);
    });

    it('loads the passages on the first @passage: token', () => {
        let loads = 0;
        passages.load = () => loads++;
        type('@pass');
        expect(loads).toBe(0);
        type('@passage:');
        type('@passage:x');
        expect(loads).toBe(1);
    });

    it('stays open while the passages load', () => {
        passages.loading = true;
        type('@passage:zz');
        expect(store.suggest.items).toEqual([]);
        expect(store.suggest.loadingPassages).toBe(true);
        expect(store.suggest.open).toBe(true);
        type('@npc:zz');
        expect(store.suggest.loadingPassages).toBe(false);
    });
});
