import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiEvents, createMockApi } from '../../api';
import { SourceEditorStore } from '../SourceEditorStore';

const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

const setup = async () => {
    const events = new ApiEvents({ createEventSource: undefined });
    const api = createMockApi({ events });
    const store = new SourceEditorStore('passage', 'village-thomas-intro', api, events);
    await store.start();
    return { api, events, store };
};

describe('SourceEditorStore', () => {
    it('loads the file and saves the whole text with its version', async () => {
        const { api, store } = await setup();
        expect(store.base?.file).toBe('data/chapters/village/thomas.passages/intro.ts');
        expect(store.dirty).toBe(false);
        store.setText(store.text + '\n// edited\n');
        expect(store.dirty).toBe(true);
        expect(await store.save()).toBe(true);
        expect(store.dirty).toBe(false);
        expect((await api.getSource('passage', 'village-thomas-intro')).text).toContain('// edited');
        store.destroy();
    });

    it('keeps the text and shows the diagnostics of a 422', async () => {
        const { api, store } = await setup();
        const diagnostics = [
            { file: store.base!.file, line: 2, column: 5, message: 'bad', code: 2322 },
            { file: 'data/register.ts', line: 1, column: 1, message: 'broken elsewhere' },
        ];
        vi.spyOn(api, 'updateSource').mockRejectedValueOnce(new ApiError(422, { error: 'invalid', diagnostics }));
        store.setText('broken');
        expect(await store.save()).toBe(false);
        expect(store.text).toBe('broken');
        expect(store.fileDiagnostics).toHaveLength(1);
        expect(store.otherDiagnostics).toHaveLength(1);
        store.destroy();
    });

    it('turns 409 stale into Reload / Keep mine', async () => {
        const { api, store } = await setup();
        const first = store.base!;
        await api.updateSource('passage', 'village-thomas-intro', { version: first.version, text: 'theirs' });
        store.setText('mine');
        await flush();
        expect(store.conflict?.current?.text).toBe('theirs');
        await store.keepMine();
        expect(store.conflict).toBeNull();
        expect((await api.getSource('passage', 'village-thomas-intro')).text).toBe('mine');

        await api.updateSource('passage', 'village-thomas-intro', { version: store.base!.version, text: 'again' });
        store.setText('mine 2');
        await flush();
        store.reloadFromDisk();
        expect(store.text).toBe('again');
        expect(store.dirty).toBe(false);
        store.destroy();
    });

    it('replaces a clean text when the file changes on disk', async () => {
        const { api, store } = await setup();
        await api.updateSource('passage', 'village-thomas-intro', { version: store.base!.version, text: 'new' });
        await flush();
        expect(store.text).toBe('new');
        expect(store.conflict).toBeNull();
        store.destroy();
    });
});
