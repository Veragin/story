import {
    buildPath,
    ROUTES,
    type TApiErrorBody,
    type TEntityDtoByKind,
    type TEntityKind,
    type TEntityListDto,
    type TRouteBody,
    type TRouteName,
    type TRouteParams,
    type TRouteResponse,
} from '@story/visualizer-protocol';
import { ApiError } from './ApiError';
import type { TVisualizerApi } from './types';

export type THttpApiOptions = {
    /** Prefix for every route; `''` = same origin, i.e. through the Vite `/api` proxy. */
    baseUrl?: string;
    fetch?: typeof fetch;
    /**
     * Called with the `version` of every resource a mutation returns — wire it to
     * `apiEvents.markSaved` so the client does not refetch its own saves (plan §3 point 3).
     */
    onSaved?: (version: string) => void;
};

const parseError = async (res: Response): Promise<TApiErrorBody> => {
    try {
        const body = (await res.json()) as Partial<TApiErrorBody>;
        if (typeof body?.error === 'string') return body as TApiErrorBody;
    } catch {
        // not JSON (e.g. the proxy's own 502/504 page when the server is down)
    }
    return {
        error: res.status === 404 ? 'not_found' : 'internal',
        message: res.status >= 502 && res.status <= 504 ? 'Visualizer server unreachable' : res.statusText,
    };
};

/**
 * Low-level typed request for any protocol route:
 *
 *     await request('getChapter', { chapterId: 'village' });
 *     await request('updateChapter', { chapterId }, { version, title: 'Village' });
 */
export const createRequest = ({ baseUrl = '', fetch: fetchImpl = fetch, onSaved }: THttpApiOptions = {}) => {
    return async <R extends TRouteName>(
        route: R,
        params: TRouteParams<R>,
        body?: TRouteBody<R>
    ): Promise<TRouteResponse<R>> => {
        const { method } = ROUTES[route];
        let res: Response;
        try {
            res = await fetchImpl(baseUrl + buildPath(route, params), {
                method,
                headers: body === undefined ? undefined : { 'content-type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
        } catch (e) {
            throw new ApiError(0, { error: 'internal', message: `Network error: ${(e as Error).message}` }, route);
        }
        if (!res.ok) {
            throw new ApiError(res.status, await parseError(res), route);
        }
        const json = (await res.json()) as TRouteResponse<R>;
        if (method !== 'GET' && onSaved) {
            const version = (json as { version?: unknown } | null)?.version;
            if (typeof version === 'string' && version !== '') onSaved(version);
        }
        return json;
    };
};

/** `TVisualizerApi` over HTTP. */
export const createHttpApi = (options: THttpApiOptions = {}): TVisualizerApi => {
    const request = createRequest(options);
    return {
        health: () => request('health', {}),
        getProject: () => request('getProject', {}),

        createChapter: (body) => request('createChapter', {}, body),
        getChapter: (chapterId) => request('getChapter', { chapterId }),
        updateChapter: (chapterId, body) => request('updateChapter', { chapterId }, body),
        deleteChapter: (chapterId, body) => request('deleteChapter', { chapterId }, body),
        openChapter: (chapterId) => request('openChapter', { chapterId }),
        addChapterCharacter: (chapterId, body) => request('addChapterCharacter', { chapterId }, body),
        removeChapterCharacter: (chapterId, characterId, body) =>
            request('removeChapterCharacter', { chapterId, characterId }, body),

        listChapterPassages: (chapterId) => request('listChapterPassages', { chapterId }),
        createPassage: (chapterId, body) => request('createPassage', { chapterId }, body),
        getPassage: (passageId) => request('getPassage', { passageId }),
        updatePassage: (passageId, body) => request('updatePassage', { passageId }, body),
        deletePassage: (passageId, body) => request('deletePassage', { passageId }, body),
        openPassage: (passageId) => request('openPassage', { passageId }),

        createTrigger: (chapterId, body) => request('createTrigger', { chapterId }, body),
        getTrigger: (triggerId) => request('getTrigger', { triggerId }),
        updateTrigger: (triggerId, body) => request('updateTrigger', { triggerId }, body),
        deleteTrigger: (triggerId, body) => request('deleteTrigger', { triggerId }, body),

        listEntities: async <K extends TEntityKind>(kind: K) =>
            (await request('listEntities', { kind })) as TEntityListDto<K>,
        createEntity: async <K extends TEntityKind>(kind: K, body: TRouteBody<'createEntity'>) =>
            (await request('createEntity', { kind }, body)) as TEntityDtoByKind[K],
        getEntity: async <K extends TEntityKind>(kind: K, id: string) =>
            (await request('getEntity', { kind, id })) as TEntityDtoByKind[K],
        updateEntity: async <K extends TEntityKind>(kind: K, id: string, body: TRouteBody<'updateEntity'>) =>
            (await request('updateEntity', { kind, id }, body)) as TEntityDtoByKind[K],
        deleteEntity: (kind, id, body) => request('deleteEntity', { kind, id }, body),

        getMap: (mapId) => request('getMap', { mapId }),
        updateMap: (mapId, body) => request('updateMap', { mapId }, body),

        getTimelineLayout: () => request('getTimelineLayout', {}),
        updateTimelineLayout: (body) => request('updateTimelineLayout', {}, body),
        getChapterLayout: (chapterId) => request('getChapterLayout', { chapterId }),
        updateChapterLayout: (chapterId, body) => request('updateChapterLayout', { chapterId }, body),
    };
};
