const readStoryId = (search: string = typeof window === 'undefined' ? '' : window.location.search) =>
    new URLSearchParams(search).get('story') || null;

const useMock = import.meta.env.VITE_VISUALIZER_API === 'mock';

export const STORY_ID: string = readStoryId() ?? (useMock ? 'example' : '');

const onThisHost = (port: number) => `${window.location.protocol}//${window.location.hostname}:${port}`;

export const landingUrl = (): string => import.meta.env.VITE_LANDING_URL || onThisHost(8103);

export const playerUrl = (storyId: string): string =>
    `${import.meta.env.VITE_PLAYER_URL || onThisHost(8100)}/?story=${encodeURIComponent(storyId)}`;

export const goToLanding = () => window.location.assign(landingUrl());
