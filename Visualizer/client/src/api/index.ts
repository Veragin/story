import { AuthStore } from './auth';
import { ApiEvents } from './events';
import { createHttpApi, createRequest } from './httpApi';
import { createMockApi } from './mockApi';
import { goToLanding, STORY_ID } from './story';
import type { TVisualizerApi } from './types';

export { ApiError } from './ApiError';
export { ApiEvents } from './events';
export { createMockApi, displayText, extractEdges, type TMockApi } from './mockApi';
export { createMockSeed } from './mockData';
export { goToLanding, landingUrl, STORY_ID } from './story';
export type { TVisualizerApi } from './types';

const useMock = import.meta.env.VITE_VISUALIZER_API === 'mock';

// no 401 handling: these must not open the login prompt themselves
const plainRequest = createRequest();

export const auth = new AuthStore(STORY_ID, {
    login: (password) => plainRequest('login', { storyId: STORY_ID }, { password }),
    storyName: async () => (await plainRequest('listStories', {})).find((s) => s.id === STORY_ID)?.name ?? null,
    onCancel: goToLanding,
});

// an `EventSource` can't see a 401, so probe with a plain request to trigger the login prompt
export const apiEvents = new ApiEvents(
    useMock ? { createEventSource: null } : { onGiveUp: () => void httpApi.getStoryInfo().catch(() => undefined) }
);
auth.onLogin(() => apiEvents.reconnectNow());

const httpApi: TVisualizerApi = createHttpApi({
    onSaved: (version) => apiEvents.markSaved(version),
    onMutation: () => apiEvents.hold(),
    onUnauthorized: (error) => auth.requireLogin(error),
});

const mockApi = createMockApi({ events: apiEvents });

export const api: TVisualizerApi = useMock ? mockApi : httpApi;
