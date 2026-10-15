import { createRoot } from 'react-dom/client';
import { Alert } from '@mui/material';
import { Engine } from './Engine';
import { Wrapper } from './Wrapper';
import { GlobalThemeWrapper, PasswordDialog } from '@story/ui';
import '@story/ui/index.css';
import { setStoryImages, storyIcon } from './images';
import { getStoryAccess, getStoryName, login, StoryApiError } from './storyApi';
import { loadStory, startStory } from './worldState';

const container = document.getElementById('root');
if (container === null) throw new Error('Missing #root element');
const root = createRoot(container);

const landingUrl = () =>
    import.meta.env.VITE_LANDING_URL ||
    `${window.location.protocol}//${window.location.hostname}:8103`;

const toLanding = () => window.location.replace(landingUrl());

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
                    onSubmit={async (password) => {
                        await login(storyId, password);
                        resolve(true);
                    }}
                    onCancel={() => resolve(false)}
                />
            </GlobalThemeWrapper>
        );
    });
};

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

const start = async (storyId: string) => {
    try {
        await boot(storyId);
    } catch (err: unknown) {
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
    }
};

const storyId = new URLSearchParams(window.location.search).get('story');
if (!storyId) {
    toLanding();
} else {
    void start(storyId);
}
