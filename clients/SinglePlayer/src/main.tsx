import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LinearProgress } from '@mui/material';
import type { TPlayManifestDto } from '@story/protocol';
import { GlobalThemeWrapper, PasswordDialog } from '@story/ui';
import '@story/ui/index.css';
import { Engine } from './Engine';
import { ErrorScreen } from './ErrorScreen';
import { setStoryImages, storyIcon, storyImageFiles } from './images';
import { toLanding } from './links';
import { ServerStorySource } from './source/ServerStorySource';
import { StaticStorySource } from './source/StaticStorySource';
import { IS_STANDALONE, standaloneProblem } from './standalone';
import type { TPlaySource } from './source/TPlaySource';
import { getStoryName, login, StoryApiError } from './storyApi';
import { Wrapper } from './Wrapper';
import { loadStory, startStory } from './worldState';

type TOpenedStory = { source: TPlaySource; manifest: TPlayManifestDto };

const container = document.getElementById('root');
if (container === null) throw new Error('Missing #root element');
const root = createRoot(container);

const render = (node: ReactNode) =>
    root.render(<GlobalThemeWrapper>{node}</GlobalThemeWrapper>);

const unlock = async (storyId: string): Promise<boolean> => {
    const storyName = await getStoryName(storyId);
    return new Promise((resolve) => {
        render(
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
        );
    });
};

// 401 until the session holds the story's grant: its password, or opened from the Visualizer by an editor
const loadServerManifest = async (
    source: ServerStorySource
): Promise<TPlayManifestDto | null> => {
    try {
        return await source.loadManifest();
    } catch (err: unknown) {
        if (!(err instanceof StoryApiError && err.status === 401)) throw err;
        return (await unlock(source.storyId))
            ? loadServerManifest(source)
            : null;
    }
};

// on our own host there is no `play.json` (the page itself answers instead): not a standalone export
const loadStaticManifest = async (
    source: StaticStorySource
): Promise<TPlayManifestDto | null> => {
    try {
        return await source.loadManifest();
    } catch {
        return null;
    }
};

const openStory = async (
    storyId: string | null
): Promise<TOpenedStory | null> => {
    if (storyId) {
        const source = new ServerStorySource(storyId);
        const manifest = await loadServerManifest(source);
        return manifest && { source, manifest };
    }
    const source = new StaticStorySource();
    const manifest = await loadStaticManifest(source);
    return manifest && { source, manifest };
};

const setFavicon = (href: string | undefined) => {
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = href;
    document.head.appendChild(link);
};

const boot = async (storyId: string | null) => {
    const opened = await openStory(storyId);
    if (opened === null) {
        return IS_STANDALONE
            ? render(<ErrorScreen message={standaloneProblem()} />)
            : toLanding();
    }
    const { source, manifest } = opened;

    document.title = manifest.name;
    setStoryImages(storyImageFiles(manifest.files, source.fileUrl));
    setFavicon(storyIcon());
    render(<LinearProgress />);

    const { s, e } = startStory(
        await loadStory(source, manifest.files),
        manifest.id
    );

    render(
        <Wrapper s={s} e={e}>
            <Engine manifest={manifest} />
        </Wrapper>
    );
};

const errorMessage = (storyId: string | null, err: unknown) => {
    if (err instanceof StoryApiError && err.status === 404) {
        return _('The story "%s" does not exist.', storyId ?? '');
    }
    const reason = err instanceof Error ? err.message : String(err);
    return `${_('Could not load the story "%s".', storyId ?? '')} ${reason}`;
};

const start = async (storyId: string | null) => {
    try {
        await boot(storyId);
    } catch (err: unknown) {
        console.error(err);
        render(<ErrorScreen message={errorMessage(storyId, err)} />);
    }
};

// a static host has no play API behind `?story=`
void start(
    IS_STANDALONE
        ? null
        : new URLSearchParams(window.location.search).get('story')
);
