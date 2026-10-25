import {
    buildGlobalPath,
    buildPath,
    GLOBAL_ROUTES,
    STORY_ROUTES,
    storyImportForm,
    type TApiErrorBody,
    type TApiErrorCode,
    type TCreateStoryBody,
    type TGitDto,
    type TGlobalRouteName,
    type THealthDto,
    type TImportStoryBody,
    type TRouteBody,
    type TRouteParams,
    type TRouteResponse,
    type TSessionDto,
    type TSetupGitBody,
    type TStoryDto,
    type TStoryInfoDto,
    type TStoryListItemDto,
    type TUpdateGitConfigBody,
    type TUpdateStoryBody,
} from '@story/protocol';

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

    get isStale() {
        return this.body.error === 'stale';
    }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export type TLandingApi = {
    health(): Promise<THealthDto>;
    listStories(): Promise<TStoryListItemDto[]>;
    createStory(body: TCreateStoryBody): Promise<TStoryDto>;
    importStory(zip: Blob, body: TImportStoryBody): Promise<TStoryDto>;
    login(storyId: string, password: string): Promise<void>;
    getSession(): Promise<TSessionDto>;
    getStoryInfo(storyId: string): Promise<TStoryInfoDto>;
    updateStoryInfo(storyId: string, body: TUpdateStoryBody): Promise<TStoryInfoDto>;
    getGit(storyId: string): Promise<TGitDto>;
    setupGit(storyId: string, body: TSetupGitBody): Promise<TGitDto>;
    updateGitConfig(storyId: string, body: TUpdateGitConfigBody): Promise<TGitDto>;
};

type TLandingStoryRoute = 'getStoryInfo' | 'updateStoryInfo' | 'getGit' | 'setupGit' | 'updateGitConfig';

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
        message: res.status >= 502 && res.status <= 504 ? 'Story server unreachable' : res.statusText,
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
    const storyRequest = <R extends TLandingStoryRoute>(storyId: string, route: R, body?: TRouteBody<R>) =>
        send<TRouteResponse<R>>(
            fetchImpl,
            baseUrl + buildPath<TLandingStoryRoute>(storyId, route, {}),
            jsonInit(STORY_ROUTES[route].method, body)
        );
    return {
        health: () => request('health', {}),
        listStories: () => request('listStories', {}),
        createStory: (body) => request('createStory', {}, body),
        importStory: (zip, body) =>
            send<TStoryDto>(fetchImpl, baseUrl + buildGlobalPath('importStory', {}), {
                method: GLOBAL_ROUTES.importStory.method,
                // the browser sets the multipart content type with its boundary
                body: storyImportForm(zip, body),
            }),
        login: (storyId, password) => request('login', { storyId }, { password }),
        getSession: () => request('getSession', {}),
        getStoryInfo: (storyId) => storyRequest(storyId, 'getStoryInfo'),
        updateStoryInfo: (storyId, body) => storyRequest(storyId, 'updateStoryInfo', body),
        getGit: (storyId) => storyRequest(storyId, 'getGit'),
        setupGit: (storyId, body) => storyRequest(storyId, 'setupGit', body),
        updateGitConfig: (storyId, body) => storyRequest(storyId, 'updateGitConfig', body),
    };
};
