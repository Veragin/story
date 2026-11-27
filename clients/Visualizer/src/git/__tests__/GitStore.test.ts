import '@story/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TSetupGitBody } from '@story/protocol';
import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import { settle } from '../../stores/__tests__/mockStores';
import { GitStore } from '../GitStore';

const SETUP: TSetupGitBody = { remoteUrl: 'https://example.com/story.git', branch: 'main', initial: 'push' };

describe('GitStore', () => {
    let events: ApiEvents;
    let api: TMockApi;
    let store: GitStore;
    let now: number;
    let release: () => void;

    const create = (overrides: Partial<TMockApi> = {}) => {
        events = new ApiEvents({ createEventSource: undefined });
        api = { ...createMockApi({ events }), ...overrides };
        now = 1_000_000;
        store = new GitStore({ api, events, refreshDelayMs: 0, now: () => now });
        release = store.start();
    };

    const edit = async () => {
        const layout = await api.getTimelineLayout();
        await api.updateTimelineLayout({ ...layout, version: layout.version });
        await settle();
    };

    beforeEach(async () => {
        create();
        await settle();
    });

    afterEach(() => release());

    it('is available but not configured until set up, then tracks the first commit', async () => {
        expect(store.available).toBe(true);
        expect(store.configured).toBe(false);

        const result = await store.setup(SETUP);
        expect(result.ok).toBe(true);
        expect(store.status).toMatchObject({ branch: 'main', ahead: 0, behind: 0, upstream: 'origin/main' });
        expect(store.status?.head?.subject).toBe('Initial story');
    });

    it('hides itself without a write grant or when the server has no git', async () => {
        release();
        create({ getStoryAccess: () => Promise.resolve({ canEdit: false, canPlay: true }) });
        const getGit = vi.spyOn(api, 'getGit');
        await settle();
        expect(store.available).toBe(false);
        expect(getGit).not.toHaveBeenCalled();

        release();
        events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events, gitAvailable: false });
        store = new GitStore({ api, events });
        release = store.start();
        await settle();
        expect(store.available).toBe(false);
    });

    it('refreshes the dirty count after own editor writes, and commits them', async () => {
        await store.setup(SETUP);
        await edit();
        expect(store.changeCount).toBe(1);
        expect(store.dirty).toBe(true);

        const result = await store.commit('Move chapters', true);
        expect(result.ok && result.value.pushed).toBe(true);
        expect(store.dirty).toBe(false);
        expect(store.status?.ahead).toBe(0);

        const nothing = await store.commit('Again', true);
        expect(nothing.ok).toBe(false);
        expect(!nothing.ok && nothing.code).toBe('git_nothing_to_commit');
    });

    it('keeps a commit whose push was rejected, then pulls and pushes it', async () => {
        await store.setup(SETUP);
        api.simulateRemoteGitCommit({ subject: 'From elsewhere' });
        await edit();

        const result = await store.commit('Local work', true);
        expect(result.ok && result.value.pushed).toBe(false);
        expect(result.ok && result.value.pushError?.error).toBe('git_rejected');
        expect(store.lastError).toContain('Pull first');
        expect(store.status?.ahead).toBe(1);

        const pushed = await store.pullThenPush();
        expect(pushed.ok).toBe(true);
        expect(store.status).toMatchObject({ ahead: 0, behind: 0 });
        expect(store.status?.head?.subject).toBe('Merge origin/main');
    });

    it('refuses pull and switching with uncommitted changes, and reports conflicting files', async () => {
        await store.setup(SETUP);
        await store.checkout('feature', true);
        await store.checkout('main', false);
        await edit();
        const pull = await store.pull();
        expect(!pull.ok && pull.code).toBe('git_dirty');
        const checkout = await store.checkout('feature', false);
        expect(!checkout.ok && checkout.code).toBe('git_dirty');

        await store.commit('Local work', false);
        api.simulateRemoteGitCommit({ conflict: ['data/layout/timeline.ts'] });
        const conflict = await store.pull();
        expect(!conflict.ok && conflict.files).toEqual(['data/layout/timeline.ts']);
        expect(store.lastError).toContain('data/layout/timeline.ts');
        expect(store.busy).toBe(false);
    });

    it('switches to new, local and remote branches and reloads the stores after a checkout', async () => {
        await store.setup(SETUP);
        const resync = vi.fn();
        events.onResync(resync);

        expect((await store.checkout('feature', true)).ok).toBe(true);
        expect(store.status?.localBranches).toEqual(['feature', 'main']);
        expect((await store.checkout('main', false)).ok).toBe(true);
        await settle();
        expect(resync).toHaveBeenCalledTimes(1);

        api.simulateRemoteGitCommit({ branch: 'theirs' });
        await store.fetch({ force: true });
        expect(store.status?.remoteBranches).toContain('theirs');
        expect((await store.checkout('theirs', false)).ok).toBe(true);
        expect(store.status?.branch).toBe('theirs');

        const bad = await store.checkout('no..dots', true);
        expect(!bad.ok && bad.code).toBe('bad_request');
    });

    it('creates a branch that keeps the uncommitted changes', async () => {
        await store.setup(SETUP);
        await edit();
        expect((await store.checkout('carried', true)).ok).toBe(true);
        expect(store.status).toMatchObject({ branch: 'carried' });
        expect(store.dirty).toBe(true);
    });

    it('discards the uncommitted changes and reloads the stores', async () => {
        await store.setup(SETUP);
        await edit();
        const resync = vi.fn();
        events.onResync(resync);
        expect((await store.discard()).ok).toBe(true);
        await settle();
        expect(store.dirty).toBe(false);
        expect(resync).toHaveBeenCalledTimes(1);
    });

    it('force pushes over a remote that is ahead', async () => {
        await store.setup(SETUP);
        api.simulateRemoteGitCommit({ subject: 'From elsewhere' });
        await edit();
        await store.commit('Local work', false);
        const push = await store.push();
        expect(!push.ok && push.code).toBe('git_rejected');
        expect((await store.forcePush()).ok).toBe(true);
        await store.fetch({ force: true });
        expect(store.status).toMatchObject({ ahead: 0, behind: 0 });
    });

    it('lists the branches with their tips and deletes them', async () => {
        await store.setup(SETUP);
        api.simulateRemoteGitCommit({ branch: 'theirs', subject: 'Their work' });
        await store.fetch({ force: true });
        await store.checkout('mine', true);
        await store.checkout('main', false);

        const listed = await store.loadBranches();
        expect(listed.ok).toBe(true);
        const byName = new Map(store.branches?.map((b) => [b.name, b]));
        expect(byName.get('theirs')).toMatchObject({
            current: false,
            local: false,
            remote: true,
            commit: { subject: 'Their work' },
        });
        expect(byName.get('main')).toMatchObject({ current: true, local: true, remote: true });
        expect(byName.get('mine')).toMatchObject({ current: false, local: true, remote: false });

        const current = await store.deleteBranch('main', false);
        expect(!current.ok && current.code).toBe('bad_request');
        expect((await store.deleteBranch('mine', false)).ok).toBe(true);
        expect((await store.deleteBranch('theirs', true)).ok).toBe(true);
        expect(store.status).toMatchObject({ localBranches: ['main'], remoteBranches: ['main'] });
    });

    it('throttles fetch to once per 30 s unless forced', async () => {
        await store.setup(SETUP);
        const gitFetch = vi.spyOn(api, 'gitFetch');
        await store.fetch();
        await store.fetch();
        expect(gitFetch).toHaveBeenCalledTimes(1);

        api.simulateRemoteGitCommit();
        now += 30_000;
        await store.fetch();
        expect(gitFetch).toHaveBeenCalledTimes(2);
        expect(store.status?.behind).toBe(1);

        await store.fetch({ force: true });
        expect(gitFetch).toHaveBeenCalledTimes(3);
    });

    it('saves the config without sending the token back, removes the token and disconnects', async () => {
        await store.setup({ ...SETUP, token: 'secret' });
        expect(store.config?.hasToken).toBe(true);
        expect(JSON.stringify(store.dto)).not.toContain('secret');

        await store.saveConfig({ authorName: 'Ann' });
        expect(store.config).toMatchObject({ authorName: 'Ann', hasToken: true });
        await store.saveConfig({ token: null });
        expect(store.config?.hasToken).toBe(false);

        expect((await store.disconnect(true)).ok).toBe(true);
        expect(store.configured).toBe(false);
        expect(store.available).toBe(true);
    });
});
