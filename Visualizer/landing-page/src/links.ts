import { buildPath } from '@story/visualizer-protocol';

/**
 * Where the story buttons go. The Visualizer and SingleEngine are other apps on other ports; by
 * default they are on this page's host (so `localhost`, `127.0.0.1` or a LAN address all work),
 * and `VITE_VISUALIZER_URL` / `VITE_ENGINE_URL` override them (no trailing slash).
 */
const onThisHost = (port: number) => `${window.location.protocol}//${window.location.hostname}:${port}`;

const visualizerBase = () => import.meta.env.VITE_VISUALIZER_URL || onThisHost(8101);
const engineBase = () => import.meta.env.VITE_ENGINE_URL || onThisHost(8100);

/** Open: the Visualizer on the story, map page first. */
export const visualizerUrl = (storyId: string) => `${visualizerBase()}/?story=${encodeURIComponent(storyId)}#/map`;

/** Play as single: SingleEngine on the story. */
export const engineUrl = (storyId: string) => `${engineBase()}/?story=${encodeURIComponent(storyId)}`;

/**
 * Export: the zip, through this page's own `/api` proxy, so the `story_session` cookie goes with
 * it. The server answers it as an attachment, so navigating there downloads without leaving.
 */
export const exportUrl = (storyId: string) => buildPath(storyId, 'exportStory', {});
