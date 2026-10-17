import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import {
    $,
    $$,
    click,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { settle } from '../../stores/__tests__/mockStores';
import { GitCommitDialog } from '../GitCommitDialog';
import { GitStore } from '../GitStore';

describe('GitCommitDialog', () => {
    let api: TMockApi;
    let store: GitStore;
    let release: () => void;
    let onClose: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        store = new GitStore({ api, events, refreshDelayMs: 0 });
        release = store.start();
        await settle();
        await store.setup({
            remoteUrl: 'https://example.com/story.git',
            branch: 'main',
            initial: 'push',
        });
        const layout = await api.getTimelineLayout();
        await api.updateTimelineLayout(layout);
        await settle();
        onClose = vi.fn<() => void>();
        await mountAsync(<GitCommitDialog store={store} onClose={onClose} />);
    });

    afterEach(() => {
        unmount();
        release();
    });

    const submit = () =>
        act(async () => {
            click('[role=dialog] button[type=submit]');
            await settle();
        });

    it('lists the changes by kind, needs a message, and commits and pushes', async () => {
        expect(get('[data-kind=modified]').textContent).toContain(
            'data/layout/timeline.ts'
        );
        expect(
            get<HTMLButtonElement>('[role=dialog] button[type=submit]').disabled
        ).toBe(true);
        expect(get<HTMLInputElement>('input[aria-label=push]').checked).toBe(
            true
        );

        typeInto(
            get<HTMLTextAreaElement>('textarea[aria-label=message]'),
            'Tidy the timeline'
        );
        await submit();

        expect(onClose).toHaveBeenCalled();
        expect(store.dirty).toBe(false);
        expect(store.status?.ahead).toBe(0);
    });

    it('shows a rejected push and recovers with pull then push', async () => {
        api.simulateRemoteGitCommit({ subject: 'From elsewhere' });
        typeInto(
            get<HTMLTextAreaElement>('textarea[aria-label=message]'),
            'Local work'
        );
        await submit();

        expect(onClose).not.toHaveBeenCalled();
        expect(get('[role=dialog]').textContent).toContain(
            'Committed locally, but the push failed'
        );
        expect($('textarea[aria-label=message]')).toBeNull();
        const pullThenPush = $$('[role=dialog] button').find(
            (b) => b.textContent === 'Pull then push'
        );
        expect(pullThenPush).toBeDefined();

        await act(async () => {
            pullThenPush?.click();
            await settle();
        });
        expect(onClose).toHaveBeenCalled();
        expect(store.status).toMatchObject({ ahead: 0, behind: 0 });
    });
});
