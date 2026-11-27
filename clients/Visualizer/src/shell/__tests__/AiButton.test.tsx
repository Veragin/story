import '@story/shared';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TStoryInfoDto } from '@story/protocol';
import { createMockApi } from '../../api';
import {
    $,
    get,
    mountAsync,
    unmount,
} from '../../components/inputs/__tests__/dom';
import { AI_OPEN_KEY, AiStore } from '../../ai/AiStore';
import { settle } from '../../stores/__tests__/mockStores';
import { removeUiState } from '../../ui-state';
import { AiButton } from '../AiButton';

describe('AiButton', () => {
    afterEach(() => {
        unmount();
        removeUiState(AI_OPEN_KEY);
    });

    const render = async ({ aiFeature = true, aiAvailable = true } = {}) => {
        const api = createMockApi({ aiAvailable });
        const story = await api.getStoryInfo();
        const info: TStoryInfoDto =
            story.access === 'edit' ? { ...story, aiFeature } : story;
        const store = new AiStore({ api });
        await mountAsync(<AiButton store={store} info={{ info }} />);
        await act(settle);
        return store;
    };

    const button = () => $<HTMLButtonElement>('button[aria-label="AI agent"]');

    it('shows with the story feature on and the agent available, and toggles the sidebar', async () => {
        const store = await render();
        expect(button()).not.toBeNull();
        expect(
            get('button[aria-label="AI agent"]').getAttribute('aria-pressed')
        ).toBe('false');
        act(() => get('button[aria-label="AI agent"]').click());
        expect(store.open).toBe(true);
        expect(
            get('button[aria-label="AI agent"]').getAttribute('aria-pressed')
        ).toBe('true');
    });

    it('is hidden when the story has no AI feature', async () => {
        await render({ aiFeature: false });
        expect(button()).toBeNull();
    });

    it('is hidden when the server cannot run agents', async () => {
        await render({ aiAvailable: false });
        expect(button()).toBeNull();
    });

    it('is hidden for a public (view-only) story info', async () => {
        const store = new AiStore({ api: createMockApi() });
        await mountAsync(
            <AiButton
                store={store}
                info={{
                    info: {
                        access: 'public',
                        id: 'x',
                        name: 'X',
                        author: '',
                        description: '',
                    },
                }}
            />
        );
        await act(settle);
        expect(button()).toBeNull();
    });
});
