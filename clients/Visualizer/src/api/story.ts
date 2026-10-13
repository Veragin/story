const readStoryId = (search: string = typeof window === 'undefined' ? '' : window.location.search) =>
    new URLSearchParams(search).get('story') || null;

const useMock = import.meta.env.VITE_VISUALIZER_API === 'mock';

export const STORY_ID: string = readStoryId() ?? (useMock ? 'example' : '');

export const landingUrl = (): string =>
    import.meta.env.VITE_LANDING_URL || `${window.location.protocol}//${window.location.hostname}:8103`;

export const goToLanding = () => window.location.assign(landingUrl());
