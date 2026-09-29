import { createRoot } from 'react-dom/client';
import { Alert } from '@mui/material';
import { Engine } from './Engine';
import { Wrapper } from './Wrapper';
import { GlobalThemeWrapper, PasswordDialog } from '@story/ui';
import '@story/ui/index.css';
import { setStoryImages, storyIcon } from './images';
import { getStoryAccess, getStoryName, login, StoryApiError } from './storyApi';
import { loadStory, startStory } from './worldState';

/**
 * Boot (multiple stories, phase 9). SingleEngine plays the story named by `?story=<id>` (the
 * landing page's "Play as single" links here):
 *
 *  1. `GET /api/stories/:id/access`; an unknown story goes back to the landing page
 *  2. if `!canPlay` (a private story this browser has not unlocked): `PasswordDialog`, then log in;
 *     a cancel goes back to the landing page
 *  3. import the story's virtual module (`worldState.ts#loadStory`), which the dev server only
 *     serves once step 1 says `canPlay` for this browser (`vite/storiesPlugin.ts`)
 *  4. `createWorldState(register, itemInfo, id)` (`startStory`)
 *  5. render
 *
 * Without `?story=` there is nothing to play: straight to the landing page.
 */
const root = createRoot(document.getElementById('root')!);

/** The landing page: `VITE_LANDING_URL`, else this host on port 8103. */
const landingUrl = () =>
    import.meta.env.VITE_LANDING_URL ||
    `${window.location.protocol}//${window.location.hostname}:8103`;

const toLanding = () => window.location.replace(landingUrl());

/** Asks for the story's password until it logs in (`true`) or the player cancels (`false`). */
const unlock = async (storyId: string): Promise<boolean> => {
    const storyName = await getStoryName(storyId);
    return new Promise((resolve) => {
        root.render(
            <GlobalThemeWrapper>
                <PasswordDialog
                    open
                    storyName={storyName}
                    message={_(
                        'This story is private: enter its password to play it.'
                    )}
                    onSubmit={(password) =>
                        login(storyId, password).then(() => resolve(true))
                    }
                    onCancel={() => resolve(false)}
                />
            </GlobalThemeWrapper>
        );
    });
};

/** The favicon is the story's own `data/assets/story.png`, when it has one. */
const setFavicon = (href: string | undefined) => {
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = href;
    document.head.appendChild(link);
};

const boot = async (storyId: string) => {
    const access = await getStoryAccess(storyId);
    if (!access.canPlay && !(await unlock(storyId))) return toLanding();

    const story = await loadStory(storyId);
    setStoryImages(story.images);
    setFavicon(storyIcon());
    const { s, e } = startStory(story, storyId);

    root.render(
        <GlobalThemeWrapper>
            <Wrapper s={s} e={e}>
                <Engine />
            </Wrapper>
        </GlobalThemeWrapper>
    );
};

const storyId = new URLSearchParams(window.location.search).get('story');
if (!storyId) {
    toLanding();
} else {
    boot(storyId).catch((err: unknown) => {
        if (err instanceof StoryApiError && err.status === 404)
            return toLanding();
        console.error(err);
        root.render(
            <GlobalThemeWrapper>
                <Alert severity="error" sx={{ m: 2 }}>
                    {_('Could not load the story "%s".', storyId)}{' '}
                    {err instanceof Error ? err.message : String(err)}
                </Alert>
            </GlobalThemeWrapper>
        );
    });
}
