import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PNG_SIGNATURE } from '@story/protocol';
import { ApiEvents, createMockApi, type TMockApi } from '../../../api';
import {
    $,
    $$,
    click,
    fire,
    get,
    mountAsync,
    typeInto,
    unmount,
} from '../../../components/inputs/__tests__/dom';
import { GitStore } from '../../../git/GitStore';
import { ModalHost } from '../../../shell/ModalHost';
import { modals } from '../../../shell/modals';
import type { TSettingsSection } from '../../../shell/router';
import { StoryInfoStore } from '../../../shell/storyInfoStore';
import { settle } from '../../../stores/__tests__/mockStores';
import { StorySettingsPage } from '../StorySettingsPage';

describe('StorySettingsPage', () => {
    let api: TMockApi;
    let git: GitStore;
    let info: StoryInfoStore;
    let release: () => void;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events });
        git = new GitStore({ api, events, refreshDelayMs: 0 });
        info = new StoryInfoStore(api);
        release = git.start();
        await settle();
    });

    afterEach(() => {
        act(() => modals.closeAll());
        unmount();
        release();
    });

    const mountPage = async (section?: TSettingsSection) => {
        await mountAsync(
            <>
                <StorySettingsPage
                    section={section}
                    api={api}
                    git={git}
                    storyInfo={info}
                />
                <ModalHost />
            </>
        );
        await act(settle);
    };

    const field = (name: string) =>
        get<HTMLInputElement>(`input[data-field="${name}"]`);

    const buttonByText = (text: string) => {
        const button = $$<HTMLButtonElement>('button').find(
            (b) => b.textContent === text
        );
        if (!button) throw new Error(`No ${text} button`);
        return button;
    };

    const choosePng = async () => {
        const input = get<HTMLInputElement>('input[type=file]');
        const file = new File(
            [new Uint8Array([...PNG_SIGNATURE, 0])],
            'landing.png',
            { type: 'image/png' }
        );
        Object.defineProperty(input, 'files', { value: [file] });
        fire(input, new Event('change', { bubbles: true }));
        await act(settle);
    };

    it('edits and saves the story', async () => {
        await mountPage();
        expect(field('name').value).toBe('Example (mock)');

        typeInto(field('name'), 'Renamed');
        typeInto(field('email'), 'me@example.com');
        await act(async () => {
            click('[data-action="save-story-settings"]');
            await settle();
        });

        expect(await api.getStoryInfo()).toMatchObject({
            name: 'Renamed',
            email: 'me@example.com',
        });
        expect(info.info?.name).toBe('Renamed');
    });

    it('expands the git section on its route and refreshes the author email after a save', async () => {
        await git.setup({
            remoteUrl: 'https://example.com/story.git',
            branch: 'main',
            initial: 'push',
        });
        await mountPage('git');
        expect(get('[aria-expanded="true"]').textContent).toContain(
            'Git repository'
        );
        const authorEmail = () =>
            get<HTMLInputElement>('input[aria-label="Author email"]').value;
        expect(authorEmail()).toBe('example@story.local');

        typeInto(field('email'), 'me@example.com');
        await act(async () => {
            click('[data-action="save-story-settings"]');
            await settle();
        });

        expect(authorEmail()).toBe('me@example.com');
    });

    it('uploads and removes the landing image', async () => {
        await mountPage();
        await info.load();
        expect($('img')).toBeNull();

        await choosePng();
        expect(get('img').getAttribute('src')).toMatch(/^data:image\/png/);
        expect(info.info).toMatchObject({ hasLandingImage: true });

        click('[data-action="remove-image"]');
        await act(settle);
        act(() => buttonByText('Remove').click());
        await act(settle);
        expect($('img')).toBeNull();
        expect(info.info).toMatchObject({ hasLandingImage: false });
    });
});
