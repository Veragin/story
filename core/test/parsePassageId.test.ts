import { describe, expect, it } from 'vitest';
import { buildWorldState, parsePassageId, type Engine } from '@story/core';
import type { TPassageId } from '@story/shared';
import { getWholePassageId, type TChapterId, type TChapterPassage } from '@story/types';
import { itemInfo, register, type TWorldState } from '@story/data';

/**
 * `parsePassageId` is the one place that knows a passage id is three dash-separated segments,
 * and `getWholePassageId` is the one place that builds one. They are inverses and nothing
 * checks that: `History`, `Story` and `Processor` all route on the parsed halves, so a change
 * to either side silently sends turns to the wrong character or chapter.
 */
describe('parsePassageId', () => {
    it('splits a passage id into chapter, character and local id', () => {
        expect(parsePassageId('village-thomas-intro')).toEqual({
            chapterId: 'village',
            characterId: 'thomas',
            id: 'intro',
        });
    });

    it('round-trips with getWholePassageId', () => {
        const passage = {
            chapterId: 'village',
            characterId: 'thomas',
            id: 'intro',
        } as TChapterPassage<'village'>;

        const whole = getWholePassageId(passage);
        expect(whole).toBe('village-thomas-intro');

        const parsed = parsePassageId(whole);
        expect(parsed.chapterId).toBe(passage.chapterId);
        expect(parsed.characterId).toBe(passage.characterId);
        expect(parsed.id).toBe(passage.id);
    });

    it('round-trips every passage the story actually registers', async () => {
        const s = buildWorldState(register, itemInfo);

        for (const chapterId of Object.keys(register.passages) as (keyof typeof register.passages)[]) {
            const passages = (await register.passages[chapterId]()).default as Record<
                string,
                (s: TWorldState, e: Engine) => TChapterPassage<TChapterId>
            >;

            for (const [key, passageFn] of Object.entries(passages)) {
                // No passage reads the engine while it is being built — it is there for
                // `onFinish` callbacks — so a marker stands in for it.
                const passage = passageFn(s, { __notAnEngine: true } as unknown as Engine);
                expect(getWholePassageId(passage)).toBe(key);
                expect(parsePassageId(key as TPassageId)).toEqual({
                    chapterId: passage.chapterId,
                    characterId: passage.characterId,
                    id: passage.id,
                });
            }
        }
    });

    it('keeps dashes inside the local id — only the first two segments are structural', () => {
        // `rest.join('-')` is what makes this work; a naive destructure would drop `-part`.
        expect(parsePassageId('village-thomas-forest-north-part')).toEqual({
            chapterId: 'village',
            characterId: 'thomas',
            id: 'forest-north-part',
        });

        expect(
            getWholePassageId({
                chapterId: 'village',
                characterId: 'thomas',
                id: 'forest-north-part',
            } as TChapterPassage<'village'>)
        ).toBe('village-thomas-forest-north-part');
    });

    describe('malformed input (pins the current, unvalidated behaviour)', () => {
        it('returns an empty local id when the third segment is missing', () => {
            // `data/chapters/village/thomas.passages/cool.transition.ts` ships exactly this
            // shape as its `nextPassageId` — see `data/test/story.test.ts`.
            expect(parsePassageId('village-thomas-')).toEqual({
                chapterId: 'village',
                characterId: 'thomas',
                id: '',
            });
        });

        it('returns undefined halves rather than throwing on a too-short id', () => {
            expect(parsePassageId('village' as TPassageId)).toEqual({
                chapterId: 'village',
                characterId: undefined,
                id: '',
            });
            expect(parsePassageId('' as TPassageId)).toEqual({
                chapterId: '',
                characterId: undefined,
                id: '',
            });
        });

        it('does not validate that the ids exist in the register', () => {
            const parsed = parsePassageId('nope-nobody-nowhere');
            expect(parsed.chapterId).toBe('nope');
            expect(Object.keys(register.chapters)).not.toContain(parsed.chapterId);
        });
    });
});
