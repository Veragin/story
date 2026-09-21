import { beforeAll, describe, expect, it } from 'vitest';
import { buildWorldState } from '@story/core';
import type { Engine } from '@story/core';
import { DeltaTime, Time, type TPassageId } from '@story/shared';
import { getWholePassageId } from '@story/types';
import type { TChapterId, TLinkCost } from '@story/types';
import { itemInfo, register } from '../index';
import type { TWorldState } from '../TWorldState';
import { assets, resolveAsset } from '../assets';

/**
 * Schema / reference-integrity checks over the authored story (REFACTOR_PLAN §7: "the thing
 * an author is most likely to break").
 *
 * The whole project is duplicated per story (§2.1), so `data/` is the folder that changes
 * every day and `core/` is the folder that does not. Everything asserted here is derived from
 * `register` rather than hard-coded, so adding a chapter, a character or a passage extends the
 * coverage instead of dating it.
 *
 * ## Known-broken entries
 *
 * Three checks below compare against an explicit `KNOWN_*` list rather than against the empty
 * set, because the story as committed already violates them. The list is *not* a way of
 * weakening the check: the assertion is `toEqual(KNOWN_…)`, so a **new** violation fails, and
 * so does **fixing** an old one. Either way somebody has to come back here. Each entry says
 * what is wrong and what fixing it looks like.
 */

/** `nextPassageId` / `redirect` / link targets that do not name a registered passage. */
const KNOWN_DANGLING_REFERENCES = [
    // `data/chapters/village/thomas.passages/cool.transition.ts` — `nextPassageId` is
    // `'village-thomas-'`, an id with an empty local part. It typechecks because
    // `TChapterCharacterPassageId` is the template literal `${E}-${Ch}-${string}` and `''`
    // satisfies `string`. `Processor.continue` would look up
    // `passages['village-thomas-']`, get `undefined`, and throw "is not a function".
    // It has not blown up yet only because nothing links to `village-thomas-cool`, which
    // makes the transition unreachable dead content — see the reachability test below.
    // Fix: point it at a real passage (or delete the file).
    'village-thomas-cool -> village-thomas-',
];

/** Passages whose `image` names art that `data/assets/` does not contain. */
const KNOWN_UNRESOLVED_IMAGES = [
    // Both Annie passages ask for `image: 'image'` — a placeholder that was never replaced.
    // `resolveAsset` returns `undefined`, so the template renders an `<img>` with no `src`.
    // This is the same failure Phase 6 found with `hunter` (then a 404 out of `public/`),
    // which is why it is worth a test at all. Fix: add `data/assets/image.png` (or, better,
    // `data/assets/kingdom/<something>.png`) and name it from the passage.
    'kingdom-annie-intro -> "image"',
    'kingdom-annie-palace -> "image"',
];

/** Passages that no link, redirect or transition leads to, and that no character starts on. */
const KNOWN_UNREACHABLE_PASSAGES = [
    // Dead content. Reachable only if something links to it — and if something did, it would
    // immediately hit the dangling `nextPassageId` above.
    'village-thomas-cool',
];

type TAnyPassage = {
    chapterId: string;
    characterId: string;
    id: string;
    type: 'screen' | 'transition' | 'linear';
    title?: unknown;
    image?: unknown;
    description?: unknown;
    nextPassageId?: string;
    body?: { condition?: unknown; redirect?: string; text?: unknown; links?: unknown[] }[];
};

type TLoadedPassage = {
    /** The key the passage is registered under, e.g. `village-thomas-intro`. */
    key: string;
    /** The chapter module the key was found in. */
    chapterId: string;
    passage: TAnyPassage;
};

/** Loads every passage module and calls every passage function against a real world state. */
const loadPassages = async (s: TWorldState): Promise<TLoadedPassage[]> => {
    const loaded: TLoadedPassage[] = [];

    for (const chapterId of Object.keys(register.passages) as (keyof typeof register.passages)[]) {
        const module = await register.passages[chapterId]();
        const passages = module.default as Record<string, (s: TWorldState, e: Engine) => TAnyPassage>;

        for (const [key, passageFn] of Object.entries(passages)) {
            // Passage functions take `(s, e)`. Nothing in the story reads `e` at build time —
            // it is there for `onFinish` callbacks — so a marker object is enough, and if a
            // passage ever does reach for it the resulting TypeError is a finding, not a flake.
            const engine = { __notAnEngine: true } as unknown as Engine;
            loaded.push({ key, chapterId, passage: passageFn(s, engine) });
        }
    }

    return loaded;
};

/** Every passage id a passage points at, with the passage that points at it. */
const outgoingReferences = ({ key, passage }: TLoadedPassage): { from: string; to: string }[] => {
    const refs: string[] = [];

    if (passage.type === 'transition' && passage.nextPassageId !== undefined) {
        refs.push(passage.nextPassageId);
    }
    if (passage.type === 'linear' && passage.nextPassageId !== undefined) {
        refs.push(passage.nextPassageId);
    }
    for (const block of passage.body ?? []) {
        if (block.redirect !== undefined) refs.push(block.redirect);
        for (const link of (block.links ?? []) as { passageId: string }[]) {
            refs.push(link.passageId);
        }
    }

    return refs.map((to) => ({ from: key, to }));
};

let state: TWorldState;
let passages: TLoadedPassage[];
let registeredIds: Set<string>;

beforeAll(async () => {
    state = buildWorldState(register, itemInfo);
    passages = await loadPassages(state);
    registeredIds = new Set(passages.map((p) => p.key));
});

describe('register', () => {
    it('has a passage module for every chapter', () => {
        expect(Object.keys(register.passages).sort()).toEqual(Object.keys(register.chapters).sort());
    });

    it('loads every passage module it advertises', async () => {
        for (const chapterId of Object.keys(register.passages) as (keyof typeof register.passages)[]) {
            const module = await register.passages[chapterId]();
            expect(module.default, `chapter "${chapterId}" has no default export`).toBeTypeOf('object');
        }
    });

    it('registers at least one passage overall', () => {
        expect(passages.length).toBeGreaterThan(0);
    });

    it('gives every character a start passage that exists', () => {
        for (const [characterId, character] of Object.entries(register.characters)) {
            expect(character.id, `characters.${characterId}.id`).toBe(characterId);
            expect(character.startPassageId, `characters.${characterId}.startPassageId`).toBeDefined();
            expect(registeredIds, `characters.${characterId}.startPassageId`).toContain(character.startPassageId);
        }
    });

    it('keys every slice by the id the entry declares', () => {
        for (const [id, sideCharacter] of Object.entries(register.sideCharacters)) {
            expect(sideCharacter.id).toBe(id);
        }
        for (const [id, chapter] of Object.entries(register.chapters)) {
            expect(chapter.chapterId).toBe(id);
        }
        for (const [id, location] of Object.entries(register.locations)) {
            expect(location.id).toBe(id);
        }
    });

    it('gives every chapter a well-ordered time range', () => {
        for (const [id, chapter] of Object.entries(register.chapters)) {
            expect(chapter.timeRange.start, `chapters.${id}.timeRange.start`).toBeInstanceOf(Time);
            expect(chapter.timeRange.end, `chapters.${id}.timeRange.end`).toBeInstanceOf(Time);
            expect(chapter.timeRange.end.isAfter(chapter.timeRange.start), `chapters.${id} ends before it starts`).toBe(
                true
            );
        }
    });
});

describe('passage schema', () => {
    it('gives every passage an id consistent with the key it is registered under', () => {
        for (const { key, chapterId, passage } of passages) {
            expect(getWholePassageId(passage as never), `passage "${key}"`).toBe(key);
            expect(passage.chapterId, `passage "${key}" chapterId`).toBe(chapterId);
        }
    });

    it('gives every passage one of the three TPassage types', () => {
        for (const { key, passage } of passages) {
            expect(['screen', 'transition', 'linear'], `passage "${key}"`).toContain(passage.type);
        }
    });

    it('gives every variant the fields its variant requires', () => {
        for (const { key, passage } of passages) {
            if (passage.type === 'screen') {
                expect(passage.title, `screen "${key}" title`).toBeTypeOf('string');
                expect(passage.image, `screen "${key}" image`).toBeTypeOf('string');
                expect(Array.isArray(passage.body), `screen "${key}" body`).toBe(true);
                continue;
            }
            if (passage.type === 'transition') {
                expect(passage.nextPassageId, `transition "${key}" nextPassageId`).toBeTypeOf('string');
                continue;
            }
            expect(passage.description, `linear "${key}" description`).toBeTypeOf('string');
        }
    });

    it('gives every link a label, a target and a payable cost', () => {
        for (const { key, passage } of passages) {
            for (const block of passage.body ?? []) {
                for (const link of (block.links ?? []) as { text: unknown; passageId: unknown; cost?: TLinkCost }[]) {
                    expect(link.text, `link in "${key}"`).toBeTypeOf('string');
                    expect(link.passageId, `link in "${key}"`).toBeTypeOf('string');
                    if (link.cost === undefined) continue;
                    if (link.cost instanceof DeltaTime) {
                        expect(link.cost.s, `link cost in "${key}"`).toBeGreaterThanOrEqual(0);
                        continue;
                    }
                    if (link.cost.time !== undefined) {
                        expect(link.cost.time, `link cost time in "${key}"`).toBeInstanceOf(DeltaTime);
                    }
                    for (const item of link.cost.items ?? []) {
                        expect(item.amount, `link cost item in "${key}"`).toBeGreaterThan(0);
                    }
                }
            }
        }
    });

    it('never registers the same passage id twice', () => {
        expect(new Set(passages.map((p) => p.key)).size).toBe(passages.length);
    });
});

describe('reference integrity', () => {
    it('resolves every passage reference to a registered passage', () => {
        const dangling = passages
            .flatMap(outgoingReferences)
            .filter(({ to }) => !registeredIds.has(to))
            .map(({ from, to }) => `${from} -> ${to}`)
            .sort();

        // See KNOWN_DANGLING_REFERENCES at the top of the file: this is `toEqual`, not a
        // filter, so a new dangling link fails here and so does fixing the old one.
        expect(dangling).toEqual(KNOWN_DANGLING_REFERENCES);
    });

    it('resolves every characterId a passage claims', () => {
        for (const { key, passage } of passages) {
            expect(Object.keys(register.characters), `passage "${key}"`).toContain(passage.characterId);
        }
    });

    it('resolves every chapterId a passage claims', () => {
        for (const { key, passage } of passages) {
            expect(Object.keys(register.chapters), `passage "${key}"`).toContain(passage.chapterId);
        }
    });

    it('resolves every itemId referenced by a link cost or an inventory', () => {
        const itemIds = Object.keys(itemInfo);

        for (const { key, passage } of passages) {
            for (const block of passage.body ?? []) {
                for (const link of (block.links ?? []) as { cost?: TLinkCost }[]) {
                    if (link.cost === undefined || link.cost instanceof DeltaTime) continue;
                    for (const item of link.cost.items ?? []) {
                        expect(itemIds, `item cost in "${key}"`).toContain(item.id);
                    }
                    for (const tool of link.cost.tools ?? []) {
                        expect(itemIds, `tool cost in "${key}"`).toContain(tool);
                    }
                }
            }
        }

        for (const [id, character] of Object.entries({ ...register.characters, ...register.sideCharacters })) {
            for (const item of character.init.inventory) {
                expect(itemIds, `${id} starting inventory`).toContain(item.id);
            }
        }
    });

    it('resolves every locationId referenced by the register', () => {
        const locationIds = Object.keys(register.locations);

        for (const [id, chapter] of Object.entries(register.chapters)) {
            expect(locationIds, `chapters.${id}.location`).toContain(chapter.location);
        }
        for (const [id, character] of Object.entries({ ...register.characters, ...register.sideCharacters })) {
            if (character.init.location === undefined) continue;
            expect(locationIds, `${id}.init.location`).toContain(character.init.location);
        }
    });

    it('resolves every chapter a chapter names as a child', () => {
        const chapterIds = Object.keys(register.chapters);

        for (const [id, chapter] of Object.entries(register.chapters)) {
            for (const child of chapter.children) {
                expect(chapterIds, `chapters.${id}.children`).toContain(child.chapter.chapterId);
            }
        }
    });

    it('leaves no passage stranded', () => {
        const reachable = new Set<string>(
            (Object.values(register.characters) as { startPassageId?: string }[])
                .map((character) => character.startPassageId)
                .filter((id): id is string => id !== undefined)
        );
        for (const { to } of passages.flatMap(outgoingReferences)) {
            reachable.add(to);
        }

        const unreachable = passages
            .map((p) => p.key)
            .filter((key) => !reachable.has(key))
            .sort();

        // See KNOWN_UNREACHABLE_PASSAGES at the top of the file.
        expect(unreachable).toEqual(KNOWN_UNREACHABLE_PASSAGES);
    });
});

describe('story art', () => {
    it('picks the assets up through import.meta.glob', () => {
        // `data/assets/index.ts` is built on `import.meta.glob`, which only exists inside a
        // bundler. Vitest runs through Vite, so it works here — this test is what says so.
        expect(Object.keys(assets).sort()).toEqual(['hunter', 'story']);
        for (const url of Object.values(assets)) {
            expect(url, 'asset url').toBeTypeOf('string');
            expect(url.length).toBeGreaterThan(0);
        }
    });

    it('prefers chapter-scoped art over shared art', () => {
        expect(resolveAsset('hunter')).toBe(assets.hunter);
        expect(resolveAsset('hunter', 'village')).toBe(assets.hunter);
        expect(resolveAsset(undefined)).toBeUndefined();
        expect(resolveAsset('')).toBeUndefined();
    });

    it('resolves every image a passage names', () => {
        const unresolved = passages
            .filter(({ passage }) => passage.type === 'screen')
            // An empty `image` is the author saying "no art here", and `resolveAsset` returns
            // `undefined` for it by design — that is not a broken reference.
            .filter(({ passage }) => passage.image !== '')
            .filter(({ passage }) => resolveAsset(passage.image as string, passage.chapterId) === undefined)
            .map(({ key, passage }) => `${key} -> ${JSON.stringify(passage.image)}`)
            .sort();

        // See KNOWN_UNRESOLVED_IMAGES at the top of the file.
        expect(unresolved).toEqual(KNOWN_UNRESOLVED_IMAGES);
    });
});

describe('passages as functions of world state', () => {
    it('builds against the pristine world state without reading anything undefined', async () => {
        // Regression guard for coupling break (b) (REFACTOR_PLAN §4): passage files used to
        // import the app's world-state singleton at module scope. They now receive it, so
        // building the whole story against a freshly built state must be side-effect free.
        const fresh = buildWorldState(register, itemInfo);
        const built = await loadPassages(fresh);

        expect(built).toHaveLength(passages.length);
    });

    it('is pure — the same state produces the same passage twice', async () => {
        const once = await loadPassages(state);
        const twice = await loadPassages(state);

        expect(JSON.stringify(once.map((p) => p.passage))).toBe(JSON.stringify(twice.map((p) => p.passage)));
    });

    it('takes both branches of forest.ts"s `s.time.s` condition', async () => {
        // `data/chapters/village/thomas.passages/forest.ts` is the only passage that branches
        // on the clock, and it is the file coupling break (b) was written for.
        const early = buildWorldState(register, itemInfo);
        early.time = Time.fromS(0);
        const late = buildWorldState(register, itemInfo);
        late.time = Time.fromS(1000);

        const costAt = async (s: TWorldState) => {
            const forest = (await loadPassages(s)).find((p) => p.key === 'village-thomas-forest')!;
            const link = (forest.passage.body![0].links as { cost: DeltaTime }[])[0];
            return link.cost;
        };

        expect((await costAt(early)).s).toBe(DeltaTime.fromMin(1).s);
        expect((await costAt(late)).s).toBe(DeltaTime.fromMin(2).s);
    });

    it('reads Annie"s health to decide whether her intro shows anything', async () => {
        const alive = buildWorldState(register, itemInfo);
        const dead = buildWorldState(register, itemInfo);
        dead.characters.annie.health = 0;

        const conditionOf = async (s: TWorldState) => {
            const intro = (await loadPassages(s)).find((p) => p.key === 'kingdom-annie-intro')!;
            return intro.passage.body![0].condition;
        };

        expect(await conditionOf(alive)).toBe(true);
        expect(await conditionOf(dead)).toBe(false);
    });
});

describe('authored ids line up with the type-level unions', () => {
    it('spells every registered passage id as chapterId-characterId-rest', () => {
        for (const { key } of passages) {
            const [chapterId, characterId, ...rest] = key.split('-');
            expect(Object.keys(register.chapters) as TChapterId[], `passage "${key}"`).toContain(chapterId);
            expect(Object.keys(register.characters), `passage "${key}"`).toContain(characterId);
            expect(rest.join('-').length, `passage "${key}" has an empty local id`).toBeGreaterThan(0);
        }
    });

    it('never registers a passage id that parses to an empty local id', () => {
        // The dangling reference in KNOWN_DANGLING_REFERENCES is exactly this shape; this
        // test proves no *registered* passage shares the defect.
        for (const { key } of passages) {
            expect((key as TPassageId).endsWith('-')).toBe(false);
        }
    });
});
