import '@story/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PNG_SIGNATURE } from '@story/protocol';
import { createMockApi, type TMockApi } from '../../api';
import {
    $,
    $$,
    click,
    fire,
    get,
    mountAsync,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { settle } from '../../stores/__tests__/mockStores';
import { ModalHost } from '../ModalHost';
import { modals } from '../modals';
import { StoryInfoStore } from '../storyInfoStore';
import { StorySettingsDialog } from '../StorySettingsDialog';

describe('StorySettingsDialog', () => {
    let api: TMockApi;
    let store: StoryInfoStore;

    beforeEach(async () => {
        api = createMockApi();
        store = new StoryInfoStore(api);
        await store.load();
        await mountAsync(
            <>
                <StorySettingsDialog
                    store={store}
                    api={api}
                    onClose={vi.fn()}
                />
                <ModalHost />
            </>
        );
        await act(settle);
    });

    afterEach(() => {
        act(() => modals.closeAll());
        unmount();
    });

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
            {
                type: 'image/png',
            }
        );
        Object.defineProperty(input, 'files', { value: [file] });
        fire(input, new Event('change', { bubbles: true }));
        await act(settle);
    };

    it('shows the name read-only and uploads and removes the landing image', async () => {
        expect(get('[data-field="story-name"]').textContent).toBe(
            'Example (mock)'
        );
        expect($('input[value="Example (mock)"]')).toBeNull();
        expect(store.info?.hasLandingImage).toBe(false);
        expect($('img')).toBeNull();

        await choosePng();
        expect(get('img').getAttribute('src')).toMatch(/^data:image\/png/);
        expect(store.info?.hasLandingImage).toBe(true);

        click('[data-action="remove-image"]');
        await act(settle);
        act(() => buttonByText('Remove').click());
        await act(settle);
        expect($('img')).toBeNull();
        expect($('[data-action="upload-image"]')).not.toBeNull();
        expect(store.info?.hasLandingImage).toBe(false);
    });

    it('keeps the image when the removal is cancelled', async () => {
        await choosePng();
        click('[data-action="remove-image"]');
        await act(settle);
        act(() => buttonByText('Cancel').click());
        await act(settle);
        expect($('img')).not.toBeNull();
        expect(store.info?.hasLandingImage).toBe(true);
    });
});
