import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TimeManager } from '@story/shared';
import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import {
    $$,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { visualizerStoreContext } from '../../context';
import { ModalHost } from '../../shell/ModalHost';
import { modals } from '../../shell/modals';
import { settle } from '../../stores/__tests__/mockStores';
import { GitBranchDialog } from '../GitBranchDialog';
import { GitStore } from '../GitStore';

describe('GitBranchDialog', () => {
    let api: TMockApi;
    let store: GitStore;
    let release: () => void;

    const edit = async () => {
        const layout = await api.getTimelineLayout();
        await api.updateTimelineLayout(layout);
        await act(settle);
    };

    const buttonByText = (text: string) => {
        const button = $$<HTMLButtonElement>('button').find(
            (b) => b.textContent === text
        );
        if (!button) throw new Error(`No ${text} button`);
        return button;
    };

    const press = (button: HTMLElement) =>
        act(async () => {
            button.click();
            await settle();
        });

    const switchButton = (name: string) => {
        const button =
            branchRow(name).querySelector<HTMLElement>('[role=button]');
        if (!button) throw new Error(`No ${name} button`);
        return button;
    };

    const branchRow = (name: string) => {
        const row = $$('[role=dialog] li').find((li) =>
            li.textContent?.startsWith(name)
        );
        if (!row) throw new Error(`No ${name} row`);
        return row;
    };

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
        await store.checkout('feature', true);
        await store.checkout('main', false);
        api.simulateRemoteGitCommit({
            branch: 'theirs',
            subject: 'Their work',
        });
        await mountAsync(
            <visualizerStoreContext.Provider
                value={{ timeManager: new TimeManager() }}
            >
                <GitBranchDialog store={store} onClose={() => {}} />
                <ModalHost />
            </visualizerStoreContext.Provider>
        );
        await act(settle);
    });

    afterEach(() => {
        act(() => modals.closeAll());
        unmount();
        release();
    });

    it('lists the branches, and fetch brings in the remote ones', async () => {
        expect(branchRow('main').textContent).toContain('Initial story');
        expect($$('[role=dialog] li').map((li) => li.textContent)).not.toEqual(
            expect.arrayContaining([expect.stringContaining('theirs')])
        );
        await press(buttonByText('Fetch'));
        expect(branchRow('theirs').textContent).toContain('Their work');
    });

    it('with uncommitted changes, asks first; discard then switches', async () => {
        await edit();
        await press(switchButton('feature'));
        expect(document.body.textContent).toContain('Uncommitted changes');

        await press(buttonByText('Discard changes'));
        expect(store.status).toMatchObject({ branch: 'feature', changes: [] });
    });

    it('with uncommitted changes, commit & push runs before the switch', async () => {
        await edit();
        await press(switchButton('feature'));
        await press(buttonByText('Commit & push'));

        typeInto(
            get<HTMLTextAreaElement>('textarea[aria-label=message]'),
            'Before switching'
        );
        const [, commit] = $$('button[type=submit]');
        await press(commit);
        expect(store.status).toMatchObject({ branch: 'feature', changes: [] });
        await store.checkout('main', false);
        expect(store.status?.head?.subject).toBe('Before switching');
    });

    it('deletes a branch after confirming', async () => {
        await press(get('[aria-label="Delete feature"]'));
        await press(buttonByText('Delete'));
        expect(store.status?.localBranches).toEqual(['main']);
        expect(
            $$('[role=dialog] li').some((li) =>
                li.textContent?.startsWith('feature')
            )
        ).toBe(false);
    });
});
