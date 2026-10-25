import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createWorldState } from '@story/core';
import {
    exampleStoryTexts,
    memorySource,
} from '../../shared/storyLoader/__tests__/support/memorySource';
import { loadStory } from '../src/worldState';
import { renderWithSession, unmount } from './support/render';

afterEach(unmount);

const TOPBAR_FILE = 'data/engine/Topbar.tsx';

const DEEP_IMPORT_TOPBAR = `
import Bolt from '@mui/icons-material/Bolt';
import { TopbarStat } from '@story/ui';
import type { TTopbarProps } from '@story/types';

export const Topbar = ({ s }: TTopbarProps) => <TopbarStat icon={Bolt} label="Stamina" value={s.mainCharacterId} />;
`;

const renderStoryTopbar = async (texts: Record<string, string>) => {
    const source = memorySource(texts);
    const story = await loadStory(source, source.files);
    expect(source.fetched).not.toContain(TOPBAR_FILE);
    const loadTopbar = story.engine?.Topbar;
    if (loadTopbar === undefined) throw new Error('the story has no Topbar');

    const { Topbar } = await loadTopbar();
    const session = createWorldState(story, 'example');
    const container = renderWithSession(
        session,
        <Topbar s={session.s} e={session.e} />
    );
    await act(() => Promise.resolve());
    return { container, source };
};

describe('loadStory with TSX', () => {
    it('loads the example`s Topbar.tsx on demand, with the app`s React, MUI and @story/ui', async () => {
        const { container, source } =
            await renderStoryTopbar(exampleStoryTexts());

        expect(source.fetched).toContain(TOPBAR_FILE);
        expect(
            container.querySelector('[data-testid="FavoriteIcon"]')
        ).not.toBeNull();
        expect(container.textContent).toBe('100%');
    });

    it('resolves the deep `@mui/icons-material/<Name>` form to the icon', async () => {
        const { container } = await renderStoryTopbar({
            ...exampleStoryTexts(),
            [TOPBAR_FILE]: DEEP_IMPORT_TOPBAR,
        });

        expect(
            container.querySelector('[data-testid="BoltIcon"]')
        ).not.toBeNull();
        expect(container.textContent).toBe('thomas');
    });
});
