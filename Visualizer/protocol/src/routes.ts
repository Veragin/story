import type {
    TAddChapterCharacterBody,
    TChapterDto,
    TCreateChapterBody,
    TDeleteChapterBody,
    TRemoveChapterCharacterBody,
    TUpdateChapterBody,
} from './dto/chapter';
import type { TOkDto } from './dto/common';
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
import type { TImageDto, TImageOwner, TUploadImageBody } from './dto/image';
import type { THealthDto, TProjectDto } from './dto/project';
import type { TSourceDto, TSourceOwner, TUpdateSourceBody } from './dto/source';
import type {
    TCreateStoryBody,
    TLoginBody,
    TSessionDto,
    TStoryAccessDto,
    TStoryDto,
    TStoryInfoDto,
    TStoryListItemDto,
    TUpdateStoryBody,
} from './dto/story';
import type { TCreateTriggerBody, TDeleteTriggerBody, TTriggerDto, TUpdateTriggerBody } from './dto/trigger';

/**
 * Every route of the Visualizer server (plan §3 "Server API"). These tables are the single source
 * of truth: the server registers exactly these (`src/routes/*.ts`), the client builds its URLs
 * from them (`client/src/api/`). All routes are under `/api`.
 *
 * The server holds several stories (multiple stories, phase 3), so the table is split in two:
 *
 *  - `STORY_ROUTES` act on one story. Their paths are relative to the story's prefix,
 *    `storyApiPrefix(storyId)` = `/api/stories/:storyId`: `getChapter` is
 *    `GET /api/stories/example/chapters/village`.
 *  - `GLOBAL_ROUTES` are not scoped to a story (health, the story list, creating and importing a
 *    story, auth).
 *    Their paths are absolute. The server tries them first, so a global route may live under
 *    `/api/stories/…` too: `login` and `getStoryAccess` do, and they are the only routes below a
 *    story that need no grant (multiple stories, phase 4; see the server's `auth/`).
 *
 * Doc comments across the Visualizer name a story route by its relative path (`GET /project`,
 * `PUT /passages/:passageId`).
 */
export const API_PREFIX = '/api';

/** Where the stories live: `GET /api/stories` lists them, `/api/stories/:storyId/…` is one story. */
export const STORIES_PREFIX = `${API_PREFIX}/stories`;

export type THttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** The prefix of every `STORY_ROUTES` path: `storyApiPrefix('example')` → `/api/stories/example`. */
export const storyApiPrefix = (storyId: string) => `${STORIES_PREFIX}/${encodeURIComponent(storyId)}`;

export const STORY_ROUTES = {
    events: { method: 'GET', path: '/events' },
    getProject: { method: 'GET', path: '/project' },

    getStoryInfo: { method: 'GET', path: '/info' },
    updateStoryInfo: { method: 'PUT', path: '/info' },
    exportStory: { method: 'GET', path: '/export' },

    createChapter: { method: 'POST', path: '/chapters' },
    getChapter: { method: 'GET', path: '/chapters/:chapterId' },
    updateChapter: { method: 'PUT', path: '/chapters/:chapterId' },
    deleteChapter: { method: 'DELETE', path: '/chapters/:chapterId' },
    addChapterCharacter: { method: 'POST', path: '/chapters/:chapterId/characters' },
    removeChapterCharacter: { method: 'DELETE', path: '/chapters/:chapterId/characters/:characterId' },

    listChapterPassages: { method: 'GET', path: '/chapters/:chapterId/passages' },
    createPassage: { method: 'POST', path: '/chapters/:chapterId/passages' },
    getPassage: { method: 'GET', path: '/passages/:passageId' },
    updatePassage: { method: 'PUT', path: '/passages/:passageId' },
    deletePassage: { method: 'DELETE', path: '/passages/:passageId' },

    createTrigger: { method: 'POST', path: '/chapters/:chapterId/triggers' },
    getTrigger: { method: 'GET', path: '/triggers/:triggerId' },
    updateTrigger: { method: 'PUT', path: '/triggers/:triggerId' },
    deleteTrigger: { method: 'DELETE', path: '/triggers/:triggerId' },

    listEntities: { method: 'GET', path: '/entities/:kind' },
    createEntity: { method: 'POST', path: '/entities/:kind' },
    getEntity: { method: 'GET', path: '/entities/:kind/:id' },
    updateEntity: { method: 'PUT', path: '/entities/:kind/:id' },
    deleteEntity: { method: 'DELETE', path: '/entities/:kind/:id' },

    getSource: { method: 'GET', path: '/source/:owner/:id' },
    updateSource: { method: 'PUT', path: '/source/:owner/:id' },

    getImage: { method: 'GET', path: '/images/:owner/:id' },
    getImageFile: { method: 'GET', path: '/images/:owner/:id/png' },
    uploadImage: { method: 'PUT', path: '/images/:owner/:id' },

    getMap: { method: 'GET', path: '/maps/:mapId' },
    updateMap: { method: 'PUT', path: '/maps/:mapId' },

    getTimelineLayout: { method: 'GET', path: '/layout/timeline' },
    updateTimelineLayout: { method: 'PUT', path: '/layout/timeline' },
    getChapterLayout: { method: 'GET', path: '/layout/chapters/:chapterId' },
    updateChapterLayout: { method: 'PUT', path: '/layout/chapters/:chapterId' },
} as const satisfies Record<string, { method: THttpMethod; path: `/${string}` }>;

export const GLOBAL_ROUTES = {
    health: { method: 'GET', path: '/api/health' },
    listStories: { method: 'GET', path: '/api/stories' },
    createStory: { method: 'POST', path: '/api/stories' },
    importStory: { method: 'POST', path: '/api/stories/import' },

    login: { method: 'POST', path: '/api/stories/:storyId/login' },
    logout: { method: 'POST', path: '/api/logout' },
    getSession: { method: 'GET', path: '/api/session' },
    getStoryAccess: { method: 'GET', path: '/api/stories/:storyId/access' },
} as const satisfies Record<string, { method: THttpMethod; path: `${typeof API_PREFIX}/${string}` }>;

export type TStoryRouteName = keyof typeof STORY_ROUTES;
export type TGlobalRouteName = keyof typeof GLOBAL_ROUTES;
export type TRouteName = TStoryRouteName | TGlobalRouteName;

/** A route table: `STORY_ROUTES`, `GLOBAL_ROUTES`, or a slice of one. */
export type TRouteTable<N extends TRouteName = TRouteName> = {
    readonly [K in N]: { readonly method: THttpMethod; readonly path: string };
};

type TAllRoutes = typeof STORY_ROUTES & typeof GLOBAL_ROUTES;

/** `'/chapters/:chapterId/characters/:characterId'` → `'chapterId' | 'characterId'` */
type TParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
    ? Name | TParamNames<`/${Rest}`>
    : P extends `${string}:${infer Name}`
      ? Name
      : never;

/**
 * Path parameters of a route, derived from its template. `kind` is narrowed to `TEntityKind`,
 * `owner` to `TSourceOwner` for the source routes and to `TImageOwner` for the image routes.
 */
export type TRouteParams<R extends TRouteName> = {
    [K in TParamNames<TAllRoutes[R]['path']>]: K extends 'kind'
        ? TEntityKind
        : K extends 'owner'
          ? R extends 'getSource' | 'updateSource'
              ? TSourceOwner
              : TImageOwner
          : string;
};

/**
 * Request body and response body of every route. `body: undefined` means the route takes none.
 * Status codes: 200, except `create*` / `addChapterCharacter` which answer 201.
 */
export type TApiSpec = {
    health: { body: undefined; response: THealthDto };
    /** Every story, without its password hash, sorted by name, each with whether it is unlocked. */
    listStories: { body: undefined; response: TStoryListItemDto[] };
    /**
     * Create a story from the server's template: `201`, and the creator is logged in to it (the
     * `story_session` cookie gets its grant). The id is a slug of the name, with `-2`, `-3`, …
     * when taken.
     */
    createStory: { body: TCreateStoryBody; response: TStoryDto };
    /**
     * Import a story zip (as made by `exportStory`) under the id in the `?id=` query: `201`. The
     * body is the raw zip (`content-type: application/zip`, at most `MAX_STORY_ZIP_BYTES`), not
     * JSON (`RAW_BODY_ROUTES`). An id that is taken is `409 exists`. The story keeps the zip's
     * password; the importer is not logged in.
     */
    importStory: { body: undefined; response: TStoryDto };

    /**
     * Unlock a story with its password: `204` with the `story_session` cookie, which now holds a
     * 24 h grant for it (one cookie can hold grants for several stories). A wrong password is
     * `401`; after 10 wrong ones from one IP within 10 minutes, `429`.
     */
    login: { body: TLoginBody; response: undefined };
    /** Drop the session (every grant it holds) and clear the cookie: `204`. */
    logout: { body: undefined; response: undefined };
    /** The stories this browser's session has unlocked. */
    getSession: { body: undefined; response: TSessionDto };
    /** What this browser may do with a story, without a grant (SingleEngine asks before playing). */
    getStoryAccess: { body: undefined; response: TStoryAccessDto };

    /** SSE stream, not JSON — see `dto/events.ts`. */
    events: { body: undefined; response: never };
    getProject: { body: undefined; response: TProjectDto };

    /** The story's `story.json`, without the password. */
    getStoryInfo: { body: undefined; response: TStoryInfoDto };
    /** Edit it (name, author, description, public, a new password); `mapSize` is read-only. */
    updateStoryInfo: { body: TUpdateStoryBody; response: TStoryInfoDto };
    /** The whole story as `<storyId>.zip` (`application/zip`, an attachment), not JSON. */
    exportStory: { body: undefined; response: never };

    createChapter: { body: TCreateChapterBody; response: TChapterDto };
    getChapter: { body: undefined; response: TChapterDto };
    updateChapter: { body: TUpdateChapterBody; response: TChapterDto };
    deleteChapter: { body: TDeleteChapterBody; response: TOkDto };
    addChapterCharacter: { body: TAddChapterCharacterBody; response: TChapterDto };
    removeChapterCharacter: { body: TRemoveChapterCharacterBody; response: TChapterDto };

    listChapterPassages: { body: undefined; response: TChapterPassagesDto };
    createPassage: { body: TCreatePassageBody; response: TPassageDto };
    getPassage: { body: undefined; response: TPassageDto };
    updatePassage: { body: TUpdatePassageBody; response: TPassageDto };
    deletePassage: { body: TDeletePassageBody; response: TOkDto };

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

    /** The whole `.ts` file of a chapter or a passage (the in-app source editor, `dto/source.ts`). */
    getSource: { body: undefined; response: TSourceDto };
    /**
     * Replace that file's text: prettier, the in-memory type check (`422 invalid`), `409 stale`,
     * one change event (`chapter` or `passage`). The one route that rewrites a whole file.
     */
    updateSource: { body: TUpdateSourceBody; response: TSourceDto };

    getImage: { body: undefined; response: TImageDto };
    /** The PNG itself (`image/png`), not JSON — 404 when there is none. Use `TImageDto.url`. */
    getImageFile: { body: undefined; response: never };
    uploadImage: { body: TUploadImageBody; response: TImageDto };

    getMap: { body: undefined; response: TMapDto };
    updateMap: { body: TUpdateMapBody; response: TMapDto };

    getTimelineLayout: { body: undefined; response: TTimelineLayoutDto };
    updateTimelineLayout: { body: TUpdateTimelineLayoutBody; response: TTimelineLayoutDto };
    getChapterLayout: { body: undefined; response: TChapterLayoutDto };
    updateChapterLayout: { body: TUpdateChapterLayoutBody; response: TChapterLayoutDto };
};

export type TRouteBody<R extends TRouteName> = TApiSpec[R]['body'];
export type TRouteResponse<R extends TRouteName> = TApiSpec[R]['response'];

const fillTemplate = (route: string, template: string, params: object): string =>
    template.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
        const value = (params as Record<string, string | undefined>)[name];
        if (value === undefined) {
            throw new Error(`buildPath(${route}): missing parameter "${name}"`);
        }
        return encodeURIComponent(value);
    });

/**
 * Fill a story route template under the story's prefix:
 * `buildPath('example', 'getChapter', { chapterId: 'village' })` →
 * `/api/stories/example/chapters/village`. Every parameter is URI-encoded. Throws on a missing
 * parameter.
 */
export const buildPath = <R extends TStoryRouteName>(storyId: string, route: R, params: TRouteParams<R>): string =>
    storyApiPrefix(storyId) + fillTemplate(route, STORY_ROUTES[route].path, params);

/** Fill a global route template: `buildGlobalPath('health', {})` → `/api/health`. */
export const buildGlobalPath = <R extends TGlobalRouteName>(route: R, params: TRouteParams<R>): string =>
    fillTemplate(route, GLOBAL_ROUTES[route].path, params);

/**
 * Split a pathname under a story's prefix into the story id and the rest, which is what
 * `STORY_ROUTES` paths match: `/api/stories/example/chapters/village` →
 * `{ storyId: 'example', rest: '/chapters/village' }`. `null` when the pathname is not below a
 * story (`/api/stories`, `/api/health`) or the id does not decode.
 */
export const splitStoryPath = (pathname: string): { storyId: string; rest: string } | null => {
    if (!pathname.startsWith(STORIES_PREFIX + '/')) return null;
    const tail = pathname.slice(STORIES_PREFIX.length + 1);
    const slash = tail.indexOf('/');
    if (slash <= 0) return null;
    try {
        return { storyId: decodeURIComponent(tail.slice(0, slash)), rest: tail.slice(slash) };
    } catch {
        return null;
    }
};

/**
 * Find the route of a method + pathname in a table (for `STORY_ROUTES`, the pathname is the part
 * after the story prefix). Returns the route and its decoded parameters, or `null`.
 */
export const matchRoute = <N extends TRouteName>(
    table: TRouteTable<N>,
    method: string,
    pathname: string
): { route: N; params: Record<string, string> } | null => {
    for (const route of Object.keys(table) as N[]) {
        const def = table[route];
        if (def.method !== method) continue;
        const params = matchPath(def.path, pathname);
        if (params) return { route, params };
    }
    return null;
};

/**
 * Match a concrete pathname against a route template. Returns the decoded parameters, or `null`.
 * Used by `matchRoute` and the server's router; exported so client mocks can reuse it.
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

/**
 * Mutations that take no body. Every other non-GET route takes a JSON object body. They still
 * send `content-type: application/json`: the server's CSRF check wants it on every mutation.
 */
export const BODYLESS_ROUTES: readonly TRouteName[] = ['logout'];

/**
 * Mutations whose body is not JSON: the handler reads the request itself. `importStory` takes
 * the raw zip and must send `content-type: application/zip` (the CSRF check wants it).
 */
export const RAW_BODY_ROUTES: readonly TRouteName[] = ['importStory'];

/** Routes that answer `204 No Content` (and no body). */
export const NO_CONTENT_ROUTES: readonly TRouteName[] = ['login', 'logout'];

/** Routes that answer `201 Created`. */
export const CREATED_ROUTES: readonly TRouteName[] = [
    'createStory',
    'importStory',
    'createChapter',
    'addChapterCharacter',
    'createPassage',
    'createTrigger',
    'createEntity',
];
