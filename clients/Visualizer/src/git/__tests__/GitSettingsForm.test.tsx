import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiEvents, createMockApi, type TMockApi } from '../../api';
import {
    $,
    $$,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { settle } from '../../stores/__tests__/mockStores';
import { GitSettingsForm } from '../GitSettingsForm';
import { GitStore } from '../GitStore';

describe('GitSettingsForm', () => {
    let api: TMockApi;
    let store: GitStore;
    let release: () => void;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        store = new GitStore({ api, events, refreshDelayMs: 0 });
        release = store.start();
        await settle();
    });

    afterEach(() => {
        unmount();
        release();
    });

    const input = (label: string) =>
        get<HTMLInputElement>(`input[aria-label="${label}"]`);

    const buttonByText = (text: string) => {
        const button = $$<HTMLButtonElement>('button').find(
            (b) => b.textContent === text
        );
        if (!button) throw new Error(`No ${text} button`);
        return button;
    };

    const press = (text: string) =>
        act(async () => {
            buttonByText(text).click();
            await settle();
        });

    const submit = () =>
        act(async () => {
            get('[data-form=git-settings] button[type=submit]').click();
            await settle();
        });

    it('needs a valid remote URL, then connects', async () => {
        await mountAsync(<GitSettingsForm store={store} />);
        expect(document.body.textContent).toContain(
            'Set from the story email when that changes.'
        );

        typeInto(input('remote url'), 'not a url');
        await submit();
        expect(store.configured).toBe(false);
        expect(input('remote url').getAttribute('aria-invalid')).toBe('true');

        typeInto(input('remote url'), 'https://example.com/story.git');
        typeInto(input('author email'), 'me@example.com');
        await submit();

        expect(store.config).toMatchObject({
            remoteUrl: 'https://example.com/story.git',
            authorEmail: 'me@example.com',
        });
    });

    it('saves only the changed fields of a connected story', async () => {
        await store.setup({
            remoteUrl: 'https://example.com/story.git',
            branch: 'main',
            initial: 'push',
        });
        await mountAsync(<GitSettingsForm store={store} />);
        expect(input('remote url').value).toBe('https://example.com/story.git');
        expect(input('author email').value).toBe('example@story.local');

        typeInto(input('author name'), 'Jane');
        await press('Save git settings');

        expect(store.config).toMatchObject({
            authorName: 'Jane',
            authorEmail: 'example@story.local',
        });
        expect($('[role=alert].MuiAlert-standardError')).toBeNull();
    });

    it('disconnects after the confirmation panel', async () => {
        await store.setup({
            remoteUrl: 'https://example.com/story.git',
            branch: 'main',
            initial: 'push',
        });
        await mountAsync(<GitSettingsForm store={store} />);

        await press('Disconnect…');
        await press('Disconnect');

        expect(store.configured).toBe(false);
    });
});
