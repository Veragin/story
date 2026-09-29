/**
 * `client/src/api` — the Visualizer client's only door to story data (plan §3). Built on
 * `@story/visualizer-protocol`, so URLs, bodies and responses are typed end to end.
 *
 *     import { api, apiEvents, ApiError } from '../api';
 *
 *     const chapter = await api.getChapter('village');            // TChapterDto, with .version
 *     await api.updateChapter('village', { version: chapter.version, title: 'Village' });
 *     const off = apiEvents.subscribe({ kind: 'chapter', id: 'village' }, () => refetch());
 *
 * Story-scoped calls and the event stream go to one story's routes (`/api/stories/<id>/…`), the
 * one named by `STORY_ID` (`story.ts`, from `?story=`). Without a grant for it the server answers
 * `401`: `auth` (`auth.ts`) then shows the password prompt, and the request is retried once after
 * the login.
 *
 * `api` is the real server behind the Vite `/api` proxy, or the in-memory `mockApi` when the app
 * runs with `VITE_VISUALIZER_API=mock` (e.g. `VITE_VISUALIZER_API=mock yarn dev:visualizer`).
 * `mockApi` is also exported on its own for code that has to use it regardless (the passage graph,
 * until WP6 moves it to the server) and for tests (`createMockApi` gives a fresh instance).
 */
import { AuthStore } from './auth';
import { ApiEvents } from './events';
import { createHttpApi, createRequest } from './httpApi';
import { createMockApi } from './mockApi';
import { goToLanding, STORY_ID } from './story';
import type { TVisualizerApi } from './types';

export { ApiError, isApiError } from './ApiError';
export { AuthStore, type TAuthOptions } from './auth';
export { ApiEvents, matchesFilter, type TEventFilter, type TEventListener, type TConnectionStatus } from './events';
export { createHttpApi, createRequest, type THttpApiOptions } from './httpApi';
export { createMockApi, displayText, extractEdges, type TMockApi, type TMockApiOptions } from './mockApi';
export { createMockSeed, type TMockSeed } from './mockData';
export { goToLanding, landingUrl, readStoryId, STORY_ID } from './story';
export type { TVisualizerApi } from './types';

const useMock = import.meta.env.VITE_VISUALIZER_API === 'mock';

/** Requests that must not open the password prompt themselves (the login, the story list). */
const plainRequest = createRequest();

/**
 * The login state and the password prompt. Cancel goes back to the landing page. The prompt's
 * title uses the story's name from the story list, which needs no grant.
 */
export const auth = new AuthStore(STORY_ID, {
    login: (password) => plainRequest('login', { storyId: STORY_ID }, { password }),
    storyName: async () => (await plainRequest('listStories', {})).find((s) => s.id === STORY_ID)?.name ?? null,
    onCancel: goToLanding,
});

/**
 * The app-wide change feed. Stores subscribe here; in mock mode it never opens a stream.
 *
 * An `EventSource` never sees the status of a failed connect, so a missing or expired grant
 * looks like any other failure: the browser gives up on the stream. `onGiveUp` then probes with
 * `GET /info`, which goes through the 401 → prompt path like every request, and after the login
 * the stream is re-created at once instead of waiting out its backoff (its first `hello` then
 * triggers `onResync`, so the pages refetch what they missed).
 */
export const apiEvents = new ApiEvents(
    useMock ? { createEventSource: null } : { onGiveUp: () => void httpApi.getStoryInfo().catch(() => undefined) }
);
auth.onLogin(() => apiEvents.reconnectNow());

/**
 * The real server, through the Vite `/api` proxy. Own saves are marked so their echo is ignored
 * (events are held while a mutation is in flight: the echo can beat the response); a 401 asks
 * for the password and retries.
 */
export const httpApi: TVisualizerApi = createHttpApi({
    onSaved: (version) => apiEvents.markSaved(version),
    onMutation: () => apiEvents.hold(),
    onUnauthorized: (error) => auth.requireLogin(error),
});

/** In-memory api seeded with the sample story; its mutations emit into `apiEvents`. */
export const mockApi = createMockApi({ events: apiEvents });

export const api: TVisualizerApi = useMock ? mockApi : httpApi;
