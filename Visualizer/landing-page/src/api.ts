import {
    buildGlobalPath,
    buildPath,
    GLOBAL_ROUTES,
    STORY_ROUTES,
    STORY_ZIP_CONTENT_TYPE,
    type TApiErrorBody,
    type TApiErrorCode,
    type TCreateStoryBody,
    type TGlobalRouteName,
    type TRouteBody,
    type TRouteParams,
    type TRouteResponse,
    type TSessionDto,
    type TStoryDto,
    type TStoryInfoDto,
    type TStoryListItemDto,
    type TUpdateStoryBody,
} from '@story/visualizer-protocol';

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: TApiErrorBody
    ) {
        super(body.message ?? `${body.error} (${status})`);
        this.name = 'ApiError';
    }

    get code(): TApiErrorCode {
        return this.body.error;
    }

    get isUnauthorized() {
        return this.status === 401;
    }

    get isExists() {
        return this.body.error === 'exists';
    }

    get isStale() {
        return this.body.error === 'stale';
    }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export type TLandingApi = {
    listStories(): Promise<TStoryListItemDto[]>;
    createStory(body: TCreateStoryBody): Promise<TStoryDto>;
    importStory(zip: Blob, id: string): Promise<TStoryDto>;
    login(storyId: string, password: string): Promise<void>;
    getSession(): Promise<TSessionDto>;
    getStoryInfo(storyId: string): Promise<TStoryInfoDto>;
    updateStoryInfo(storyId: string, body: TUpdateStoryBody): Promise<TStoryInfoDto>;
};

export type TLandingApiOptions = {
    baseUrl?: string;
    fetch?: typeof fetch;
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

const send = async <T>(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<T> => {
    let res: Response;
    try {
        res = await fetchImpl(url, init);
    } catch (e) {
        throw new ApiError(0, { error: 'internal', message: `Network error: ${errorMessage(e)}` });
    }
    if (!res.ok) throw new ApiError(res.status, await parseError(res));
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
};

const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    // on every mutation, bodyless ones included: the server's CSRF check requires it
    headers: method === 'GET' ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
});

export const createLandingApi = ({ baseUrl = '', fetch: fetchImpl = fetch }: TLandingApiOptions = {}): TLandingApi => {
    const request = <R extends TGlobalRouteName>(route: R, params: TRouteParams<R>, body?: TRouteBody<R>) =>
        send<TRouteResponse<R>>(
            fetchImpl,
            baseUrl + buildGlobalPath(route, params),
            jsonInit(GLOBAL_ROUTES[route].method, body)
        );
    return {
        listStories: () => request('listStories', {}),
        createStory: (body) => request('createStory', {}, body),
        importStory: (zip, id) =>
            send<TStoryDto>(
                fetchImpl,
                `${baseUrl}${buildGlobalPath('importStory', {})}?id=${encodeURIComponent(id)}`,
                // raw body (`RAW_BODY_ROUTES`): the CSRF check wants the zip content type here
                {
                    method: GLOBAL_ROUTES.importStory.method,
                    headers: { 'content-type': STORY_ZIP_CONTENT_TYPE },
                    body: zip,
                }
            ),
        login: (storyId, password) => request('login', { storyId }, { password }),
        getSession: () => request('getSession', {}),
        getStoryInfo: (storyId) =>
            send(
                fetchImpl,
                baseUrl + buildPath(storyId, 'getStoryInfo', {}),
                jsonInit(STORY_ROUTES.getStoryInfo.method, undefined)
            ),
        updateStoryInfo: (storyId, body) =>
            send(
                fetchImpl,
                baseUrl + buildPath(storyId, 'updateStoryInfo', {}),
                jsonInit(STORY_ROUTES.updateStoryInfo.method, body)
            ),
    };
};
