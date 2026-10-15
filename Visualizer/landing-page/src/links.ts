import { buildPath } from '@story/visualizer-protocol';

const onThisHost = (port: number) => `${window.location.protocol}//${window.location.hostname}:${port}`;

const visualizerBase = () => import.meta.env.VITE_VISUALIZER_URL || onThisHost(8101);
const engineBase = () => import.meta.env.VITE_ENGINE_URL || onThisHost(8100);

export const visualizerUrl = (storyId: string) => `${visualizerBase()}/?story=${encodeURIComponent(storyId)}#/map`;

export const engineUrl = (storyId: string) => `${engineBase()}/?story=${encodeURIComponent(storyId)}`;

// same-origin via the `/api` proxy so the session cookie is sent
export const exportUrl = (storyId: string) => buildPath(storyId, 'exportStory', {});
