import type {
    TAddChapterCharacterBody,
    TChapterDto,
    TCreateChapterBody,
    TDeleteChapterBody,
    TRemoveChapterCharacterBody,
    TUpdateChapterBody,
} from './dto/chapter';
import type { TOkDto, TOpenDto } from './dto/common';
import type {
    TCreateEntityBody,
    TDeleteEntityBody,
    TEntityDto,
    TEntityKind,
    TEntityListDto,
    TUpdateEntityBody,
} from './dto/entity';
import type {
    TChapterLayoutDto,
    TTimelineLayoutDto,
    TUpdateChapterLayoutBody,
    TUpdateTimelineLayoutBody,
} from './dto/layout';
import type { TMapDto, TUpdateMapBody } from './dto/map';
import type {
    TChapterPassagesDto,
    TCreatePassageBody,
    TDeletePassageBody,
    TPassageDto,
    TUpdatePassageBody,
} from './dto/passage';
import type { THealthDto, TProjectDto } from './dto/project';
import type { TCreateTriggerBody, TDeleteTriggerBody, TTriggerDto, TUpdateTriggerBody } from './dto/trigger';

/**
 * Every route of the Visualizer server (plan §3 "Server API"). This table is the single source
 * of truth: the server registers exactly these (`src/routes/*.ts`), the client builds its URLs
 * from them (`client/src/api/`). All routes are under `/api`.
 */
export const API_PREFIX = '/api';

export type THttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const ROUTES = {
    health: { method: 'GET', path: '/api/health' },
    events: { method: 'GET', path: '/api/events' },
    getProject: { method: 'GET', path: '/api/project' },

    createChapter: { method: 'POST', path: '/api/chapters' },
    getChapter: { method: 'GET', path: '/api/chapters/:chapterId' },
    updateChapter: { method: 'PUT', path: '/api/chapters/:chapterId' },
    deleteChapter: { method: 'DELETE', path: '/api/chapters/:chapterId' },
    openChapter: { method: 'POST', path: '/api/chapters/:chapterId/open' },
    addChapterCharacter: { method: 'POST', path: '/api/chapters/:chapterId/characters' },
    removeChapterCharacter: { method: 'DELETE', path: '/api/chapters/:chapterId/characters/:characterId' },

    listChapterPassages: { method: 'GET', path: '/api/chapters/:chapterId/passages' },
    createPassage: { method: 'POST', path: '/api/chapters/:chapterId/passages' },
    getPassage: { method: 'GET', path: '/api/passages/:passageId' },
    updatePassage: { method: 'PUT', path: '/api/passages/:passageId' },
    deletePassage: { method: 'DELETE', path: '/api/passages/:passageId' },
    openPassage: { method: 'POST', path: '/api/passages/:passageId/open' },

    createTrigger: { method: 'POST', path: '/api/chapters/:chapterId/triggers' },
    getTrigger: { method: 'GET', path: '/api/triggers/:triggerId' },
    updateTrigger: { method: 'PUT', path: '/api/triggers/:triggerId' },
    deleteTrigger: { method: 'DELETE', path: '/api/triggers/:triggerId' },

    listEntities: { method: 'GET', path: '/api/entities/:kind' },
    createEntity: { method: 'POST', path: '/api/entities/:kind' },
    getEntity: { method: 'GET', path: '/api/entities/:kind/:id' },
    updateEntity: { method: 'PUT', path: '/api/entities/:kind/:id' },
    deleteEntity: { method: 'DELETE', path: '/api/entities/:kind/:id' },

    getMap: { method: 'GET', path: '/api/maps/:mapId' },
    updateMap: { method: 'PUT', path: '/api/maps/:mapId' },

    getTimelineLayout: { method: 'GET', path: '/api/layout/timeline' },
    updateTimelineLayout: { method: 'PUT', path: '/api/layout/timeline' },
    getChapterLayout: { method: 'GET', path: '/api/layout/chapters/:chapterId' },
    updateChapterLayout: { method: 'PUT', path: '/api/layout/chapters/:chapterId' },
} as const satisfies Record<string, { method: THttpMethod; path: `${typeof API_PREFIX}${string}` }>;

export type TRouteName = keyof typeof ROUTES;

/** `'/api/chapters/:chapterId/characters/:characterId'` → `'chapterId' | 'characterId'` */
type TParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
    ? Name | TParamNames<`/${Rest}`>
    : P extends `${string}:${infer Name}`
      ? Name
      : never;

/** Path parameters of a route, derived from its template. `kind` is narrowed to `TEntityKind`. */
export type TRouteParams<R extends TRouteName> = {
    [K in TParamNames<(typeof ROUTES)[R]['path']>]: K extends 'kind' ? TEntityKind : string;
};

/**
 * Request body and response body of every route. `body: undefined` means the route takes none.
 * Status codes: 200, except `create*` / `addChapterCharacter` which answer 201.
 */
export type TApiSpec = {
    health: { body: undefined; response: THealthDto };
    /** SSE stream, not JSON — see `dto/events.ts`. */
    events: { body: undefined; response: never };
    getProject: { body: undefined; response: TProjectDto };

    createChapter: { body: TCreateChapterBody; response: TChapterDto };
    getChapter: { body: undefined; response: TChapterDto };
    updateChapter: { body: TUpdateChapterBody; response: TChapterDto };
    deleteChapter: { body: TDeleteChapterBody; response: TOkDto };
    openChapter: { body: undefined; response: TOpenDto };
    addChapterCharacter: { body: TAddChapterCharacterBody; response: TChapterDto };
    removeChapterCharacter: { body: TRemoveChapterCharacterBody; response: TChapterDto };

    listChapterPassages: { body: undefined; response: TChapterPassagesDto };
    createPassage: { body: TCreatePassageBody; response: TPassageDto };
    getPassage: { body: undefined; response: TPassageDto };
    updatePassage: { body: TUpdatePassageBody; response: TPassageDto };
    deletePassage: { body: TDeletePassageBody; response: TOkDto };
    openPassage: { body: undefined; response: TOpenDto };

    createTrigger: { body: TCreateTriggerBody; response: TTriggerDto };
    getTrigger: { body: undefined; response: TTriggerDto };
    updateTrigger: { body: TUpdateTriggerBody; response: TTriggerDto };
    deleteTrigger: { body: TDeleteTriggerBody; response: TOkDto };

    /** The response is `TEntityListDto<K>` for the requested `kind`. */
    listEntities: { body: undefined; response: TEntityListDto };
    createEntity: { body: TCreateEntityBody; response: TEntityDto };
    getEntity: { body: undefined; response: TEntityDto };
    updateEntity: { body: TUpdateEntityBody; response: TEntityDto };
    deleteEntity: { body: TDeleteEntityBody; response: TOkDto };

    getMap: { body: undefined; response: TMapDto };
    updateMap: { body: TUpdateMapBody; response: TMapDto };

    getTimelineLayout: { body: undefined; response: TTimelineLayoutDto };
    updateTimelineLayout: { body: TUpdateTimelineLayoutBody; response: TTimelineLayoutDto };
    getChapterLayout: { body: undefined; response: TChapterLayoutDto };
    updateChapterLayout: { body: TUpdateChapterLayoutBody; response: TChapterLayoutDto };
};

export type TRouteBody<R extends TRouteName> = TApiSpec[R]['body'];
export type TRouteResponse<R extends TRouteName> = TApiSpec[R]['response'];

/**
 * Fill a route template: `buildPath('getChapter', { chapterId: 'village' })` →
 * `/api/chapters/village`. Every parameter is URI-encoded. Throws on a missing parameter.
 */
export const buildPath = <R extends TRouteName>(route: R, params: TRouteParams<R>): string =>
    ROUTES[route].path.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
        const value = (params as Record<string, string | undefined>)[name];
        if (value === undefined) {
            throw new Error(`buildPath(${route}): missing parameter "${name}"`);
        }
        return encodeURIComponent(value);
    });

/**
 * Match a concrete pathname against a route template. Returns the decoded parameters, or `null`.
 * Used by the server's router; exported so client mocks can reuse it.
 */
export const matchPath = (template: string, pathname: string): Record<string, string> | null => {
    const t = template.split('/');
    const p = pathname.replace(/\/+$/, '').split('/');
    if (t.length !== p.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < t.length; i++) {
        if (t[i].startsWith(':')) {
            if (p[i] === '') return null;
            try {
                params[t[i].slice(1)] = decodeURIComponent(p[i]);
            } catch {
                return null;
            }
        } else if (t[i] !== p[i]) {
            return null;
        }
    }
    return params;
};

/** Routes that answer `201 Created`. */
export const CREATED_ROUTES: readonly TRouteName[] = [
    'createChapter',
    'addChapterCharacter',
    'createPassage',
    'createTrigger',
    'createEntity',
];
