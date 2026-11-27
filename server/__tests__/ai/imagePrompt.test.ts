import { describe, expect, it } from 'vitest';
import {
    buildImagePrompt,
    imageSourceOf,
    mentionKey,
    type TImageOwnerKind,
    type TMentionTarget,
    uniqueMentions,
} from '../../src/ai/imageGen/imagePrompt';
import { isHttpError } from '../../src/common/HttpError';

const targets = (entries: Record<string, TMentionTarget<string>>) => new Map(Object.entries(entries));

const OWNER_KINDS: TImageOwnerKind[] = ['passages', 'characters', 'npcs', 'locations'];

const THOMAS = { name: 'Thomas', image: 'thomas.png' };
const VILLAGE = { name: 'Village', image: 'village.png' };

const build = (prompt: string, entries: Record<string, TMentionTarget<string>>, maxReferences = 3) =>
    buildImagePrompt({ prompt, owner: 'passages', targets: targets(entries), maxReferences });

const rejection = (task: () => unknown) => {
    try {
        task();
    } catch (e) {
        if (isHttpError(e)) return { status: e.status, body: e.body };
        throw e;
    }
    throw new Error('expected an HttpError');
};

describe('uniqueMentions', () => {
    it('lists each mention once, in order, hyphenated passage ids included', () => {
        expect(
            uniqueMentions(
                '@character:thomas meets @npc:franta, then @character:thomas in @passage:village-thomas-intro.'
            )
        ).toEqual([
            { mentionClass: 'character', id: 'thomas' },
            { mentionClass: 'npc', id: 'franta' },
            { mentionClass: 'passage', id: 'village-thomas-intro' },
        ]);
        expect(mentionKey({ mentionClass: 'location', id: 'village' })).toBe('@location:village');
    });
});

describe('buildImagePrompt', () => {
    it('rewrites mentions to names and labels each image with its name', () => {
        const prompt = build('@character:thomas standing in the middle of @location:village', {
            '@character:thomas': THOMAS,
            '@location:village': VILLAGE,
        });
        expect(prompt.references).toEqual([
            { label: 'Thomas', image: 'thomas.png' },
            { label: 'Village', image: 'village.png' },
        ]);
        expect(prompt.prompt.split('\n\n')).toEqual([
            'Thomas standing in the middle of Village',
            'Image 1 is Thomas, a character. Keep their look.\nImage 2 is Village, a location. Keep its look.',
            expect.stringMatching(/^Style: a square illustration of this scene/),
        ]);
    });

    it('names an entity without an image, an item or a chapter, but sends no image for them', () => {
        const prompt = build('@npc:franta holds @item:bow in @chapter:village', {
            '@npc:franta': { name: 'Franta', image: null },
            '@item:bow': { name: 'Bow', image: null },
            '@chapter:village': { name: 'Village Chapter', image: null },
        });
        expect(prompt.references).toEqual([]);
        expect(prompt.prompt.split('\n\n')).toEqual([
            'Franta holds Bow in Village Chapter',
            expect.stringMatching(/^Style: /),
        ]);
    });

    it('sends a duplicate mention as one reference', () => {
        const prompt = build('@character:thomas and @character:thomas again', { '@character:thomas': THOMAS });
        expect(prompt.references).toEqual([{ label: 'Thomas', image: 'thomas.png' }]);
        expect(prompt.prompt).toMatch(/^Thomas and Thomas again\n\nImage 1 is Thomas, a character/);
    });

    it('has a style line per owner kind', () => {
        const styles = OWNER_KINDS.map(
            (owner) => buildImagePrompt({ prompt: 'x', owner, targets: targets({}), maxReferences: 0 }).prompt
        );
        expect(styles[1]).toContain('portrait');
        expect(styles[3]).toContain('place');
        expect(new Set(styles).size).toBe(3);
    });

    it('refuses an unknown mention with 422 on the prompt field', () => {
        expect(rejection(() => build('@character:bob waves', {}))).toEqual({
            status: 422,
            body: {
                error: 'invalid',
                message: 'Unknown mention @character:bob: no such character',
                diagnostics: [
                    {
                        file: '',
                        line: 1,
                        column: 1,
                        message: 'Unknown mention @character:bob: no such character',
                        field: 'prompt',
                    },
                ],
            },
        });
    });

    it('refuses more images than the model takes', () => {
        const refused = rejection(() =>
            build(
                '@character:thomas in @location:village',
                { '@character:thomas': THOMAS, '@location:village': VILLAGE },
                1
            )
        );
        expect(refused.status).toBe(422);
        expect(refused.body.message).toContain('at most 1 referenced images');
        expect(build('@character:thomas', { '@character:thomas': THOMAS }, 1).references).toHaveLength(1);
    });
});

describe('imageSourceOf', () => {
    const OWNER = { owner: 'passages', id: 'village-thomas-square' } as const;
    const PASSAGE_FILE = 'data/chapters/village/thomas.passages/forest.ts';

    it("uses an entity's own image, and none for items and chapters", () => {
        expect(imageSourceOf({ mentionClass: 'character', id: 'thomas' }, OWNER)).toEqual({
            kind: 'owner',
            owner: 'characters',
            id: 'thomas',
        });
        expect(imageSourceOf({ mentionClass: 'npc', id: 'franta' }, OWNER)).toMatchObject({ owner: 'npcs' });
        expect(imageSourceOf({ mentionClass: 'location', id: 'village' }, OWNER)).toMatchObject({ owner: 'locations' });
        expect(imageSourceOf({ mentionClass: 'item', id: 'bow' }, OWNER)).toBeNull();
        expect(imageSourceOf({ mentionClass: 'chapter', id: 'village' }, OWNER)).toBeNull();
    });

    it('follows a linked passage image relative to the passage file, only to a story image', () => {
        const mention = { mentionClass: 'passage', id: 'village-thomas-forest' } as const;
        const linked = (image: string) => imageSourceOf(mention, OWNER, { file: PASSAGE_FILE, image });
        expect(linked('@intro.png')).toEqual({ kind: 'file', path: 'data/chapters/village/thomas.passages/intro.png' });
        expect(linked('@../../../characters/thomas.webp')).toEqual({
            kind: 'file',
            path: 'data/characters/thomas.webp',
        });
        expect(linked('@../../../../story.json')).toBeNull();
        expect(linked('@../../../../../outside.png')).toBeNull();
        expect(linked('A misty forest path')).toEqual({ kind: 'owner', owner: 'passages', id: mention.id });
        expect(linked('@character:thomas in the forest')).toEqual({ kind: 'owner', owner: 'passages', id: mention.id });
    });

    it('the owner itself uses its own current image, whatever its saved link', () => {
        const self = { mentionClass: 'passage', id: OWNER.id } as const;
        expect(imageSourceOf(self, OWNER, { file: PASSAGE_FILE, image: '@intro.png' })).toEqual({
            kind: 'owner',
            owner: 'passages',
            id: OWNER.id,
        });
        expect(
            imageSourceOf({ mentionClass: 'character', id: 'thomas' }, { owner: 'characters', id: 'thomas' })
        ).toEqual({ kind: 'owner', owner: 'characters', id: 'thomas' });
    });
});
