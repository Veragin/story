import '@story/shared';
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RIFF_SIGNATURE, WEBP_SIGNATURE } from '@story/protocol';
import { AiStore } from '../../../ai/AiStore';
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
    let ai: AiStore;
    let info: StoryInfoStore;
    let release: () => void;

    beforeEach(async () => {
        const events = new ApiEvents({ createEventSource: undefined });
        api = createMockApi({ events, aiCredits: 42 });
        ai = new AiStore({ api });
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

    let showSection: (section: TSettingsSection) => void = () => {};

    const Harness = ({ initial }: { initial?: TSettingsSection }) => {
        const [section, setSection] = useState(initial);
        showSection = setSection;
        return (
            <StorySettingsPage
                section={section}
                api={api}
                git={git}
                ai={ai}
                storyInfo={info}
            />
        );
    };

    const mountPage = async (section?: TSettingsSection) => {
        await mountAsync(
            <>
                <Harness initial={section} />
                <ModalHost />
            </>
        );
        await act(settle);
    };

    const open = async (section: TSettingsSection) => {
        act(() => showSection(section));
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

    const chooseWebp = async () => {
        const input = get<HTMLInputElement>('input[type=file]');
        const file = new File(
            [
                new Uint8Array([
                    ...RIFF_SIGNATURE,
                    4,
                    0,
                    0,
                    0,
                    ...WEBP_SIGNATURE,
                ]),
            ],
            'landing.webp',
            { type: 'image/webp' }
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

    it('shows General, AI and Git in the side menu, General by default', async () => {
        await mountPage();
        expect($$('[data-name]').map((entry) => entry.textContent)).toEqual([
            'General',
            'AI',
            'Git',
        ]);
        expect(get('[data-name="general"]').className).toContain(
            'Mui-selected'
        );
        expect(field('name').value).toBe('Example (mock)');
    });

    it('keeps the general draft and marks it unsaved while another section is open', async () => {
        await mountPage();
        typeInto(field('name'), 'Renamed');

        await open('ai');
        expect(
            $('[data-name="general"] [aria-label="Unsaved changes"]')
        ).not.toBeNull();

        await open('general');
        expect(field('name').value).toBe('Renamed');
    });

    it('shows the AI feature and the available credits on the AI section', async () => {
        await mountPage('ai');
        const toggle = get<HTMLInputElement>('[data-field="aiFeature"] input');
        expect(toggle.checked).toBe(true);
        expect(toggle.disabled).toBe(true);
        expect(get('[data-field="aiCredits"]').textContent).toBe('42');
        expect($('input[data-field="name"]')).toBeNull();
    });

    it('shows the git settings on the Git section and refreshes the author email after a save', async () => {
        await git.setup({
            remoteUrl: 'https://example.com/story.git',
            branch: 'main',
            initial: 'push',
        });
        await mountPage('git');
        const authorEmail = () =>
            get<HTMLInputElement>('input[aria-label="Author email"]').value;
        expect(authorEmail()).toBe('example@story.local');

        await open('general');
        typeInto(field('email'), 'me@example.com');
        await act(async () => {
            click('[data-action="save-story-settings"]');
            await settle();
        });

        await open('git');
        expect(authorEmail()).toBe('me@example.com');
    });

    it('uploads and removes the landing image', async () => {
        await mountPage();
        await info.load();
        expect($('img')).toBeNull();

        await chooseWebp();
        expect(get('img').getAttribute('src')).toMatch(/^data:image\/webp/);
        expect(info.info).toMatchObject({ hasLandingImage: true });

        click('[data-action="remove-image"]');
        await act(settle);
        act(() => buttonByText('Remove').click());
        await act(settle);
        expect($('img')).toBeNull();
        expect(info.info).toMatchObject({ hasLandingImage: false });
    });
});
