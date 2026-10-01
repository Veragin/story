import {
    buildGlobalPath,
    buildPath,
    GLOBAL_ROUTES,
    STORY_ROUTES,
    type TApiErrorBody,
    type TEntityDtoByKind,
    type TEntityKind,
    type TEntityListDto,
    type TGlobalRouteName,
    type TRouteBody,
    type TRouteName,
    type TRouteParams,
    type TRouteResponse,
    type TStoryRouteName,
} from '@story/visualizer-protocol';
import { ApiError } from './ApiError';
import { STORY_ID } from './story';
import type { TVisualizerApi } from './types';

export type THttpApiOptions = {
    baseUrl?: string;
    storyId?: string;
    fetch?: typeof fetch;
    onSaved?: (version: string) => void;
    onMutation?: () => () => void;
    onUnauthorized?: (error: ApiError) => Promise<void>;
};

// a source save rewrites whole files behind the forms' back, so its echo must reach the pages
const NOT_MARKED_SAVED: readonly TRouteName[] = ['updateSource'];

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

const isGlobalRoute = (route: TRouteName): route is TGlobalRouteName =>
    Object.prototype.hasOwnProperty.call(GLOBAL_ROUTES, route);

const endpoint = <R extends TRouteName>(storyId: string, route: R, params: TRouteParams<R>) =>
    isGlobalRoute(route)
        ? { method: GLOBAL_ROUTES[route].method, path: buildGlobalPath(route, params as TRouteParams<typeof route>) }
        : {
              method: STORY_ROUTES[route as TStoryRouteName].method,
              path: buildPath(storyId, route as TStoryRouteName, params as TRouteParams<TStoryRouteName>),
          };

export const createRequest = ({
    baseUrl = '',
    storyId = STORY_ID,
    fetch: fetchImpl = fetch,
    onSaved,
    onMutation,
    onUnauthorized,
}: THttpApiOptions = {}) => {
    return async <R extends TRouteName>(
        route: R,
        params: TRouteParams<R>,
        body?: TRouteBody<R>
    ): Promise<TRouteResponse<R>> => {
        const { method, path } = endpoint(storyId, route, params);
        const send = async (): Promise<Response> => {
            try {
                return await fetchImpl(baseUrl + path, {
                    method,
                    // on every mutation, bodyless ones included: the server's CSRF check requires it
                    headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
                    body: body === undefined ? undefined : JSON.stringify(body),
                });
            } catch (e) {
                throw new ApiError(
                    0,
                    { error: 'internal', message: `Network error: ${e instanceof Error ? e.message : String(e)}` },
                    route
                );
            }
        };
        const hold = () => (method !== 'GET' && onMutation ? onMutation() : () => {});
        let release = hold();
        try {
            let res = await send();
            if (res.status === 401 && route !== 'login' && onUnauthorized) {
                // events are not held while the password prompt is open
                release();
                await onUnauthorized(new ApiError(res.status, await parseError(res), route));
                release = hold();
                res = await send();
            }
            if (!res.ok) {
                throw new ApiError(res.status, await parseError(res), route);
            }
            if (res.status === 204) return undefined as TRouteResponse<R>;
            const json = (await res.json()) as TRouteResponse<R>;
            if (method !== 'GET' && onSaved && !NOT_MARKED_SAVED.includes(route)) {
                const version = (json as { version?: unknown } | null)?.version;
                if (typeof version === 'string' && version !== '') onSaved(version);
            }
            return json;
        } finally {
            release();
        }
    };
};

export const createHttpApi = (options: THttpApiOptions = {}): TVisualizerApi => {
    const request = createRequest(options);
    return {
        health: () => request('health', {}),
        login: (password) => request('login', { storyId: options.storyId ?? STORY_ID }, { password }),
        getStoryInfo: () => request('getStoryInfo', {}),
        getProject: () => request('getProject', {}),

        createChapter: (body) => request('createChapter', {}, body),
        getChapter: (chapterId) => request('getChapter', { chapterId }),
        updateChapter: (chapterId, body) => request('updateChapter', { chapterId }, body),
        deleteChapter: (chapterId, body) => request('deleteChapter', { chapterId }, body),
        addChapterCharacter: (chapterId, body) => request('addChapterCharacter', { chapterId }, body),
        removeChapterCharacter: (chapterId, characterId, body) =>
            request('removeChapterCharacter', { chapterId, characterId }, body),

        listChapterPassages: (chapterId) => request('listChapterPassages', { chapterId }),
        createPassage: (chapterId, body) => request('createPassage', { chapterId }, body),
        getPassage: (passageId) => request('getPassage', { passageId }),
        updatePassage: (passageId, body) => request('updatePassage', { passageId }, body),
        deletePassage: (passageId, body) => request('deletePassage', { passageId }, body),

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

        getSource: (owner, id) => request('getSource', { owner, id }),
        updateSource: (owner, id, body) => request('updateSource', { owner, id }, body),

        getImage: (owner, id) => request('getImage', { owner, id }),
        uploadImage: (owner, id, body) => request('uploadImage', { owner, id }, body),

        getMap: (mapId) => request('getMap', { mapId }),
        updateMap: (mapId, body) => request('updateMap', { mapId }, body),

        getTimelineLayout: () => request('getTimelineLayout', {}),
        updateTimelineLayout: (body) => request('updateTimelineLayout', {}, body),
        getChapterLayout: (chapterId) => request('getChapterLayout', { chapterId }),
        updateChapterLayout: (chapterId, body) => request('updateChapterLayout', { chapterId }, body),
    };
};
