import '@story/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { settle } from '../../../stores/__tests__/mockStores';
import { EngineEditorStore } from '../EngineEditorStore';
import { ENGINE_SECTION_INFO } from '../engineSections';

describe('EngineEditorStore', () => {
    let api: TMockApi;
    let store: EngineEditorStore;
    let stop: () => void;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        store = new EngineEditorStore({ api, events });
        stop = store.start();
        await settle();
    });

    afterEach(() => stop());

    it('loads both sections, a missing one as the default', () => {
        expect(store.sections.onLinkClick).toMatchObject({ exists: false, implemented: false, version: '' });
        expect(store.sections.topbar).toMatchObject({ exists: true, implemented: true });
        expect(store.resource.base?.section).toBe('onLinkClick');
        expect(store.codeOpen).toBe(false);

        store.show('topbar');
        expect(store.resource.draft?.description).toContain('Health');
        expect(store.codeOpen).toBe(true);
    });

    it('saves a description only, which writes the stub', async () => {
        store.setDescription('Links drain stamina.');
        expect(store.resource.dirty).toBe(true);
        expect(await store.resource.save()).toBe(true);

        expect(store.resource.base).toMatchObject({
            exists: true,
            implemented: false,
            description: 'Links drain stamina.',
        });
        expect(store.resource.base?.code).toContain('export const onLinkClick');
        expect(store.sections.onLinkClick?.exists).toBe(true);
        expect(store.codeOpen).toBe(false);
    });

    it('implements manually from the starter code and saves it', async () => {
        store.implementManually();
        expect(store.codeOpen).toBe(true);
        expect(store.resource.draft?.code).toBe(ENGINE_SECTION_INFO.onLinkClick.starter);

        store.setCode(`${ENGINE_SECTION_INFO.onLinkClick.starter}// edited\n`);
        expect(await store.resource.save()).toBe(true);
        expect((await api.getEngineSection('onLinkClick')).code).toContain('// edited');
        expect(store.resource.base?.implemented).toBe(true);
        expect(store.resource.dirty).toBe(false);
    });

    it('edits the code of an existing section and keeps its description', async () => {
        store.show('topbar');
        const description = store.resource.base?.description;
        store.setCode(`${store.resource.draft?.code ?? ''}// more\n`);
        expect(await store.resource.save()).toBe(true);
        const saved = await api.getEngineSection('topbar');
        expect(saved.code).toContain('// more');
        expect(saved.description).toBe(description);
    });

    it('goes stale on an external change of a dirty draft', async () => {
        store.show('topbar');
        store.setDescription('Mine');
        await api.updateEngineSection('topbar', {
            version: store.resource.base?.version ?? '',
            description: 'Theirs',
        });
        api.simulateExternalChange('engine', 'topbar');
        await settle();

        expect(store.resource.stale?.current?.description).toBe('Theirs');
        expect(store.sections.topbar?.description).toBe('Theirs');
        expect(await store.resource.save()).toBe(false);
        expect(await store.resource.keepMine()).toBe(true);
        expect((await api.getEngineSection('topbar')).description).toBe('Mine');
    });

    it('takes an external change silently while the draft is clean', async () => {
        await api.updateEngineSection('onLinkClick', { version: '', description: 'From an agent' });
        api.simulateExternalChange('engine', 'onLinkClick');
        await settle();
        expect(store.resource.stale).toBeNull();
        expect(store.resource.draft?.description).toBe('From an agent');
    });

    it('shows a 422 as diagnostics and keeps the draft', async () => {
        store.show('topbar');
        store.setCode('export const Other = () => null;\n');
        expect(await store.resource.save()).toBe(false);
        expect(store.resource.diagnostics.map((d) => d.message)).toEqual(['The file must export "Topbar"']);
        expect(store.resource.draft?.code).toBe('export const Other = () => null;\n');
        expect(store.codeDiagnostics).toEqual([]);
        expect(store.hasTypeErrors).toBe(true);
    });

    it('marks only syntax errors in the code: type error positions refer to the file on disk', async () => {
        store.show('topbar');
        const file = store.resource.base?.file ?? '';
        api.updateEngineSection = () =>
            Promise.reject(
                new ApiError(422, {
                    error: 'invalid',
                    diagnostics: [
                        { file, line: 2, column: 1, message: "')' expected.", code: 1005 },
                        { file, line: 9, column: 3, message: 'Type error', code: 2322 },
                    ],
                })
            );
        store.setCode('broken');
        expect(await store.resource.save()).toBe(false);
        expect(store.codeDiagnostics.map((d) => d.code)).toEqual([1005]);
        expect(store.hasTypeErrors).toBe(true);
    });

    it('deletes a section back to the default', async () => {
        store.show('topbar');
        expect(await store.remove()).toBe(true);
        expect(store.resource.base).toMatchObject({ section: 'topbar', exists: false, version: '' });
        expect(store.resource.draft).toEqual({ description: '', code: '' });
        expect(store.sections.topbar?.exists).toBe(false);
        expect((await api.getEngineSection('topbar')).exists).toBe(false);
    });
});
