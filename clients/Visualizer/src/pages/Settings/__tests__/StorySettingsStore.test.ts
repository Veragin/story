import '@story/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi, type TMockApi } from '../../../api';
import { GitStore } from '../../../git/GitStore';
import { settle } from '../../../stores/__tests__/mockStores';
import { StorySettingsStore } from '../StorySettingsStore';

describe('StorySettingsStore', () => {
    let api: TMockApi;
    let git: GitStore;
    let release: () => void;
    let requireLogin: ReturnType<typeof vi.fn<() => Promise<void>>>;
    let reloadInfo: ReturnType<typeof vi.fn<() => Promise<void>>>;
    let store: StorySettingsStore;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        git = new GitStore({ api, events, refreshDelayMs: 0 });
        release = git.start();
        await settle();
        requireLogin = vi.fn<() => Promise<void>>(() => Promise.resolve());
        reloadInfo = vi.fn<() => Promise<void>>(() => Promise.resolve());
        store = new StorySettingsStore({ api, auth: { requireLogin }, storyInfo: { reload: reloadInfo }, git });
    });

    afterEach(() => release());

    const edit = (patch: Partial<NonNullable<StorySettingsStore['value']>>) => {
        const value = store.value;
        if (!value) throw new Error('Not loaded');
        store.setValue({ ...value, ...patch });
    };

    it('loads the story into the form', async () => {
        await store.load();
        expect(store.info?.version).toBe('mock-story');
        expect(store.value).toMatchObject({ name: 'Example (mock)', email: '', password: '', mapWidth: '40' });
        expect(store.error).toBeNull();
        expect(requireLogin).not.toHaveBeenCalled();
    });

    it('asks for the password when the story info is public, then loads again', async () => {
        const getStoryInfo = vi
            .spyOn(api, 'getStoryInfo')
            .mockResolvedValueOnce({ access: 'public', id: 'example', name: 'Example', author: '', description: '' });
        await store.load();
        expect(requireLogin).toHaveBeenCalledOnce();
        expect(getStoryInfo).toHaveBeenCalledTimes(2);
        expect(store.info?.access).toBe('edit');
    });

    it('saves, reloads the story info and keeps the form on the saved values', async () => {
        await store.load();
        edit({ name: 'Renamed', email: ' me@example.com ' });
        expect(await store.save()).toBe(true);
        expect(store.info).toMatchObject({ name: 'Renamed', email: 'me@example.com' });
        expect(store.info?.version).not.toBe('mock-story');
        expect(store.value?.email).toBe('me@example.com');
        expect(store.submitted).toBe(false);
        expect(reloadInfo).toHaveBeenCalledOnce();
    });

    it('does not save an invalid form and blocks the submit', async () => {
        await store.load();
        const update = vi.spyOn(api, 'updateStoryInfo');
        edit({ email: 'nope' });
        expect(await store.save()).toBe(false);
        expect(store.errors.email).toBeDefined();
        expect(store.submitBlocked).toBe(true);
        expect(update).not.toHaveBeenCalled();
    });

    it('shows a stale save as a conflict, then reloads or keeps mine', async () => {
        await store.load();
        const loaded = store.info;
        if (!loaded) throw new Error('Not loaded');
        await api.updateStoryInfo({ version: loaded.version, name: 'Theirs' });

        edit({ name: 'Mine' });
        expect(await store.save()).toBe(false);
        expect(store.conflict?.name).toBe('Theirs');
        expect(store.submitBlocked).toBe(true);

        store.keepMine();
        expect(store.conflict).toBeNull();
        expect(store.value?.name).toBe('Mine');
        expect(await store.save()).toBe(true);
        expect(store.info?.name).toBe('Mine');

        const saved = store.info;
        if (!saved) throw new Error('Not saved');
        await api.updateStoryInfo({ version: saved.version, name: 'Theirs again' });
        edit({ name: 'Mine again' });
        await store.save();
        store.reload();
        expect(store.conflict).toBeNull();
        expect(store.value?.name).toBe('Theirs again');
    });

    it('refreshes git after a save, which picks up the author email from the story email', async () => {
        await git.setup({ remoteUrl: 'https://example.com/story.git', branch: 'main', initial: 'push' });
        expect(git.config?.authorEmail).toBe('example@story.local');
        await store.load();
        edit({ email: 'author@example.com' });
        expect(await store.save()).toBe(true);
        expect(git.config?.authorEmail).toBe('author@example.com');
    });
});
