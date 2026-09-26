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
 * `api` is the real server behind the Vite `/api` proxy, or the in-memory `mockApi` when the app
 * runs with `VITE_VISUALIZER_API=mock` (e.g. `VITE_VISUALIZER_API=mock yarn dev:visualizer`).
 * `mockApi` is also exported on its own for code that has to use it regardless (the passage graph,
 * until WP6 moves it to the server) and for tests (`createMockApi` gives a fresh instance).
 */
import { ApiEvents } from './events';
import { createHttpApi } from './httpApi';
import { createMockApi } from './mockApi';
import type { TVisualizerApi } from './types';

export { ApiError, isApiError } from './ApiError';
export { ApiEvents, matchesFilter, type TEventFilter, type TEventListener, type TConnectionStatus } from './events';
export { createHttpApi, createRequest, type THttpApiOptions } from './httpApi';
export { createMockApi, displayText, extractEdges, type TMockApi, type TMockApiOptions } from './mockApi';
export { createMockSeed, type TMockSeed } from './mockData';
export type { TVisualizerApi } from './types';

const useMock = import.meta.env.VITE_VISUALIZER_API === 'mock';

/** The app-wide change feed. Stores subscribe here; in mock mode it never opens a stream. */
export const apiEvents = new ApiEvents(useMock ? { createEventSource: null } : {});

/** The real server, through the Vite `/api` proxy. Own saves are marked so their echo is ignored. */
export const httpApi: TVisualizerApi = createHttpApi({ onSaved: (version) => apiEvents.markSaved(version) });

/** In-memory api seeded with the sample story; its mutations emit into `apiEvents`. */
export const mockApi = createMockApi({ events: apiEvents });

export const api: TVisualizerApi = useMock ? mockApi : httpApi;
