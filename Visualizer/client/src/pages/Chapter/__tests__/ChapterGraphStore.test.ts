import '@story/shared'; // installs the global `_`
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TPassageDto, TScreenPassageDto } from '@story/visualizer-protocol';
import { ApiError, ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { ChapterGraphStore, ReferencedError } from '../ChapterGraphStore';
import { BOX, layeredLayout, placeMissing } from '../graph/autoLayout';
import { buildGraph, ghostId } from '../graph/buildGraph';
import { mapDiagnostics, passageFieldPaths } from '../editor/diagnostics';
import { PassageEditorStore } from '../editor/PassageEditorStore';

const setup = (chapterId = 'village', saveDelayMs = 500) => {
    const events = new ApiEvents({ createEventSource: undefined });
    const api = createMockApi({ events });
    const store = new ChapterGraphStore({ chapterId, api, events, saveDelayMs }).start();
    return { api, events, store };
};

// lets the mock's setTimeout(0) event dispatch and its refetches settle
const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.useRealTimers());

describe('buildGraph', () => {
    it('builds nodes, merges parallel links, marks self loops and adds ghosts for foreign targets', async () => {
        const api = createMockApi();
        const { passages, edges } = await api.listChapterPassages('kingdom');
        const g = buildGraph(passages, edges);

        expect(g.nodes.map((n) => n.id)).toEqual([
            'kingdom-annie-intro',
            'kingdom-annie-palace',
            'kingdom-thomas-visit',
        ]);
        expect(g.nodes.find((n) => n.id === 'kingdom-thomas-visit')?.selfLoop).toBe(true);
        expect(g.nodes.find((n) => n.id === 'kingdom-thomas-visit')?.title).toBe('visit');

        const back = g.edges.find((e) => e.from === 'kingdom-annie-palace');
        expect(back).toMatchObject({ to: 'kingdom-annie-intro', count: 2, kinds: ['link'] });
        // the conditional body item makes intro → palace conditional
        expect(g.edges.find((e) => e.from === 'kingdom-annie-intro')?.conditional).toBe(true);
        expect(g.edges.some((e) => e.from === e.to)).toBe(false);
        expect(g.ghosts).toEqual([]);
    });

    it('turns a dangling transition target into an unresolved ghost', async () => {
        const api = createMockApi();
        const { passages, edges } = await api.listChapterPassages('village');
        const g = buildGraph(passages, edges);
        expect(g.ghosts).toEqual([{ id: ghostId('village-thomas-'), passageId: 'village-thomas-', resolved: false }]);
        expect(g.edges.find((e) => e.from === 'village-thomas-cool')).toMatchObject({
            to: ghostId('village-thomas-'),
            kinds: ['next'],
            resolved: false,
        });
    });
});

describe('auto layout', () => {
    const nodes = ['a-x-intro', 'a-x-b', 'a-x-c', 'a-y-intro'].map((id) => ({ id, group: id.split('-')[1] }));
    const edges = [
        { from: 'a-x-intro', to: 'a-x-b' },
        { from: 'a-x-intro', to: 'a-x-c' },
        { from: 'a-x-c', to: 'a-x-intro' },
    ];

    it('lays passages out left to right by link distance, one band per character', () => {
        const p = layeredLayout(nodes, edges);
        expect(p['a-x-intro'].x).toBe(0);
        expect(p['a-x-b'].x).toBeGreaterThan(p['a-x-intro'].x);
        expect(p['a-x-b'].x).toBe(p['a-x-c'].x);
        expect(p['a-x-b'].y).not.toBe(p['a-x-c'].y);
        // the second character's band is below the first one
        expect(p['a-y-intro'].y).toBeGreaterThan(Math.max(p['a-x-b'].y, p['a-x-c'].y));
    });

    it('places a new passage next to a placed neighbour without overlapping', () => {
        const fixed = { 'a-x-intro': { x: 100, y: 100 }, 'a-x-b': { x: 370, y: 100 }, 'a-y-intro': { x: 0, y: 400 } };
        const added = placeMissing(nodes, edges, fixed);
        expect(Object.keys(added)).toEqual(['a-x-c']);
        expect(added['a-x-c'].x).toBe(370);
        expect(Math.abs(added['a-x-c'].y - 100)).toBeGreaterThanOrEqual(BOX.height);
    });

    it('gives every passage of a chapter without a layout file a distinct position', async () => {
        const { store } = setup('village');
        await store.load();
        const ids = store.graph.nodes.map((n) => n.id);
        expect(ids).toHaveLength(3);
        const points = ids.map((id) => store.positions[id]);
        expect(points.every(Boolean)).toBe(true);
        expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(3);
        expect(store.layout?.version).toBe('');
        // the ghost of the dangling link is placed too
        expect(store.positions[ghostId('village-thomas-')]).toBeDefined();
    });
});

describe('ChapterGraphStore layout save', () => {
    it('debounces moves into one layout PUT and keeps the new version', async () => {
        vi.useFakeTimers();
        const { api, store } = setup('village', 500);
        await store.load();
        const spy = vi.spyOn(api, 'updateChapterLayout');

        store.setPosition('village-thomas-intro', { x: 10.4, y: 20 });
        vi.advanceTimersByTime(300);
        store.setPosition('village-thomas-forest', { x: 300, y: 20 });
        expect(store.saveStatus).toBe('pending');
        vi.advanceTimersByTime(300);
        expect(spy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(250);
        await vi.runAllTimersAsync();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][1]).toEqual({
            version: '',
            passages: { 'village-thomas-intro': { x: 10, y: 20 }, 'village-thomas-forest': { x: 300, y: 20 } },
        });
        expect(store.saveStatus).toBe('saved');
        const saved = await api.getChapterLayout('village');
        expect(store.layout?.version).toBe(saved.version);
        expect(saved.passages['village-thomas-intro']).toEqual({ x: 10, y: 20 });
    });

    it('on 409 stale takes the file on disk, lays its own moves over it and saves again', async () => {
        const { api, store } = setup('village', 10);
        await store.load();
        // another tab writes the layout first
        await api.updateChapterLayout('village', { version: '', passages: { 'village-thomas-cool': { x: 5, y: 5 } } });
        store.setPosition('village-thomas-intro', { x: 1, y: 2 });
        await store.flushLayout();
        const disk = await api.getChapterLayout('village');
        expect(disk.passages).toEqual({
            'village-thomas-cool': { x: 5, y: 5 },
            'village-thomas-intro': { x: 1, y: 2 },
        });
        expect(store.saveStatus).toBe('saved');
    });

    it('refreshes the layout in place on a change event, keeping unsaved moves', async () => {
        const { api, store } = setup('village', 10_000);
        await store.load();
        store.setPosition('village-thomas-intro', { x: 1, y: 1 });
        // another client writes the file (the mock marks it as our own save, so refetch by hand)
        await api.updateChapterLayout('village', {
            version: '',
            passages: { 'village-thomas-forest': { x: 9, y: 9 } },
        });
        await store.refetchLayout();
        expect(store.layout?.passages).toEqual({
            'village-thomas-forest': { x: 9, y: 9 },
            'village-thomas-intro': { x: 1, y: 1 },
        });
        await store.destroy();
    });
});

describe('ChapterGraphStore characters', () => {
    it('summarises the remove-character confirmation with the passage count', async () => {
        const { store } = setup('kingdom');
        await store.load();
        const annie = store.removeCharacterSummary('annie');
        expect(annie).toMatchObject({ name: 'Annie', chapterTitle: 'Kingdom Chapter', passageCount: 2 });
        expect(annie.message).toBe('Remove Annie from Kingdom Chapter? This deletes 2 passages.');
        expect(store.removeCharacterSummary('thomas').message).toBe(
            'Remove Thomas from Kingdom Chapter? This deletes 1 passage.'
        );
    });

    it('removes a character and its passages, or reports the references on 409', async () => {
        const { api, store } = setup('kingdom');
        await store.load();

        // annie's palace now links to thomas's visit: removing thomas must be refused
        const palace = (await api.getPassage('kingdom-annie-palace')) as TScreenPassageDto;
        const body = structuredClone(palace.body) as Exclude<TScreenPassageDto['body'], { code: string }>;
        (body[0].links as { text: string; passageId: string }[]).push({ text: 'x', passageId: 'kingdom-thomas-visit' });
        await api.updatePassage(palace.passageId, { version: palace.version, body });
        await store.refetchAll();

        const refused = await store.removeCharacter('thomas').catch((e: unknown) => e);
        expect(refused).toBeInstanceOf(ReferencedError);
        expect((refused as ReferencedError).references.map((r) => r.passageId)).toEqual(['kingdom-annie-palace']);
        expect(store.passages.some((p) => p.characterId === 'thomas')).toBe(true);

        await store.removeCharacter('annie');
        expect(store.chapterCharacters.map((c) => c.id)).toEqual(['thomas']);
        expect(store.passages.map((p) => p.passageId)).toEqual(['kingdom-thomas-visit']);
    });

    it('adds a character, offers only the ones not in the chapter, and selects the start passage', async () => {
        const { store } = setup('village');
        await store.load();
        expect(store.availableCharacters.map((c) => c.id)).toEqual(['annie']);
        await store.addCharacter('annie', 'start');
        expect(store.availableCharacters).toEqual([]);
        expect(store.passages.map((p) => p.passageId)).toContain('village-annie-start');
        expect(store.selectedId).toBe('village-annie-start');
        expect(store.positions['village-annie-start']).toBeDefined();
    });

    it('creates and deletes a passage', async () => {
        const { store } = setup('village');
        await store.load();
        await store.createPassage({ characterId: 'thomas', localId: 'lake', type: 'linear' });
        expect(store.selectedId).toBe('village-thomas-lake');
        expect(store.chapterCharacters[0].passageCount).toBe(4);
        await store.deletePassage('village-thomas-lake');
        expect(store.passages.map((p) => p.passageId)).not.toContain('village-thomas-lake');
        expect(store.selectedId).toBeNull();
    });
});

describe('passage editor', () => {
    const introOf = async (api: TMockApi) => (await api.getPassage('village-thomas-intro')) as TScreenPassageDto;

    it('maps 422 diagnostics to fields by their path, the rest to the top', async () => {
        const api = createMockApi();
        const intro = await introOf(api);
        const fields = passageFieldPaths(intro);
        expect(fields.has('body.0.links.0.cost.time')).toBe(true);

        const d = (field?: string) => ({ file: intro.file, line: 1, column: 1, message: field ?? 'none', field });
        const index = mapDiagnostics(
            [d('title'), d('body.0.links.0.cost.time.seconds'), d('body.0.links.7.text'), d('zzz'), d()],
            fields
        );
        expect([...index.byField.keys()]).toEqual(['title', 'body.0.links.0.cost.time', 'body.0.links']);
        expect(index.unmapped.map((x) => x.message)).toEqual(['zzz', 'none']);
    });

    it('sends only the changed fields and shows 422 diagnostics next to them', async () => {
        const api = createMockApi();
        const intro = await introOf(api);
        const diagnostics = [
            { file: intro.file, line: 20, column: 5, message: 'Type error', field: 'body.0.links.0.cost' },
            { file: intro.file, line: 1, column: 1, message: 'Somewhere else' },
        ];
        const update = vi
            .spyOn(api, 'updatePassage')
            .mockRejectedValueOnce(new ApiError(422, { error: 'invalid', diagnostics }));
        const editor = new PassageEditorStore(intro, api);
        editor.edit((d) => {
            if (d.type === 'screen' && Array.isArray(d.body) && Array.isArray(d.body[0].links)) {
                d.body[0].links[0].cost = { code: 'DeltaTime.fromMin(' };
            }
        });
        expect(Object.keys(editor.patch)).toEqual(['body']);

        expect(await editor.save()).toBe(false);
        expect(update.mock.calls[0][1]).toMatchObject({ version: intro.version, body: expect.any(Array) });
        expect(update.mock.calls[0][1]).not.toHaveProperty('title');
        expect(editor.diagnosticIndex.byField.get('body.0.links.0.cost')?.[0].message).toBe('Type error');
        expect(editor.diagnosticIndex.unmapped.map((x) => x.message)).toEqual(['Somewhere else']);
        expect(editor.dirty).toBe(true);

        // second try goes through to the mock
        expect(await editor.save()).toBe(true);
        expect(editor.dirty).toBe(false);
        expect(editor.diagnostics).toEqual([]);
        editor.destroy();
    });

    it('reads execute with its description, maps its diagnostics and removes it with null', async () => {
        const api = createMockApi();
        const forest = await api.getPassage('village-thomas-forest');
        expect(forest.execute).toEqual({
            code: expect.stringContaining('health += 50'),
            description: 'Annie gets healed when she is weak.',
        });
        expect(passageFieldPaths(forest).has('execute')).toBe(true);
        const update = vi.spyOn(api, 'updatePassage');
        const editor = new PassageEditorStore(forest, api);
        editor.edit((d) => {
            delete d.execute;
        });
        expect(editor.patch).toEqual({ execute: null });
        expect(await editor.save()).toBe(true);
        expect(update.mock.calls[0][1]).toMatchObject({ execute: null });
        expect((await api.getPassage('village-thomas-forest')).execute).toBeUndefined();
        editor.destroy();
    });

    it('handles 409 stale with reload / keep mine, and restores unsaved input after a reload', async () => {
        const api = createMockApi();
        const intro = await introOf(api);
        const editor = new PassageEditorStore(intro, api);
        editor.edit((d) => d.type === 'screen' && (d.title = 'Mine'));
        // someone else edits the file
        const theirs = await api.updatePassage(intro.passageId, { version: intro.version, image: 'wolf' });

        // the unsaved input is in ui-state: a new editor (page reload) picks it up, as a conflict
        const reloaded = new PassageEditorStore(theirs as TPassageDto, api);
        expect(reloaded.draft.type === 'screen' && reloaded.draft.title).toBe('Mine');
        expect(reloaded.conflict?.current?.version).toBe(theirs.version);
        reloaded.destroy();

        expect(await editor.save()).toBe(false);
        expect(editor.conflict?.current?.version).toBe(theirs.version);
        expect(await editor.keepMine()).toBe(true);
        const disk = (await api.getPassage(intro.passageId)) as TScreenPassageDto;
        expect(disk).toMatchObject({ title: 'Mine', image: 'wolf' });

        editor.edit((d) => d.type === 'screen' && (d.title = 'Draft'));
        const again = await api.updatePassage(intro.passageId, { version: disk.version, title: 'Disk' });
        editor.onExternal(again);
        expect(editor.conflict).not.toBeNull();
        editor.reloadFromDisk();
        expect(editor.draft.type === 'screen' && editor.draft.title).toBe('Disk');
        expect(editor.dirty).toBe(false);
        editor.destroy();
    });

    it('follows live changes of the open passage through apiEvents when clean', async () => {
        const { api, store } = setup('village');
        await store.load();
        store.openEditor('village-thomas-forest');
        const before = store.editor?.base.version;
        const current = await api.getPassage('village-thomas-forest');
        // an external edit (the author's editor): new content + a foreign change event
        await api.updatePassage(current.passageId, { version: current.version, title: 'Deep forest' });
        api.simulateExternalChange('passage', 'village-thomas-forest');
        await settle();
        expect(store.editor?.base.version).not.toBe(before);
        expect(store.editor?.draft.type === 'screen' && store.editor.draft.title).toBe('Deep forest');
        expect(store.graph.nodes.find((n) => n.id === 'village-thomas-forest')?.title).toBe('Deep forest');
        await store.destroy();
    });

    it('draws the open passage’s unsaved links, and drops them again on reset', async () => {
        const { store } = setup('village');
        await store.load();
        store.openEditor('village-thomas-intro');
        const editor = store.editor!;
        const edgeIds = () => store.graph.edges.map((e) => e.id);
        expect(edgeIds()).not.toContain('village-thomas-intro->village-thomas-cool');

        editor.edit((d) => {
            if (d.type === 'screen' && Array.isArray(d.body) && Array.isArray(d.body[0].links))
                d.body[0].links.push({ text: 'x', passageId: 'village-th' });
        });
        // a half-typed target is not an arrow yet
        expect(store.graph.ghosts.map((g) => g.passageId)).not.toContain('village-th');
        editor.edit((d) => {
            if (d.type === 'screen' && Array.isArray(d.body) && Array.isArray(d.body[0].links))
                d.body[0].links[1].passageId = 'village-thomas-cool';
        });
        expect(edgeIds()).toContain('village-thomas-intro->village-thomas-cool');
        expect(edgeIds()).toContain('village-thomas-intro->village-thomas-forest');

        editor.reset();
        expect(edgeIds()).not.toContain('village-thomas-intro->village-thomas-cool');
        await store.destroy();
    });
});

describe('transition targets', () => {
    it('lists the passages of the same character in the other chapters', async () => {
        const { store } = setup('village');
        await store.load();
        store.openEditor('village-thomas-cool');
        await settle();
        expect(store.transitionOptions).toEqual([{ id: 'kingdom-thomas-visit', label: 'Kingdom Chapter' }]);
        await store.destroy();
    });
});
