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
 * `STORY_ROUTES` paths are relative to `storyApiPrefix(storyId)`. `GLOBAL_ROUTES` paths are
 * absolute and matched first, so a global route may live below a story (`login`, `getStoryAccess`:
 * the only ones there that need no grant).
 */
export const API_PREFIX = '/api';

export const STORIES_PREFIX = `${API_PREFIX}/stories`;

export type THttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

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

export type TRouteParams<R extends TRouteName> = {
    [K in TParamNames<TAllRoutes[R]['path']>]: K extends 'kind'
        ? TEntityKind
        : K extends 'owner'
          ? R extends 'getSource' | 'updateSource'
              ? TSourceOwner
              : TImageOwner
          : string;
};

/** `body: undefined` means the route takes none. Status codes: see `CREATED_ROUTES`, `NO_CONTENT_ROUTES`. */
export type TApiSpec = {
    health: { body: undefined; response: THealthDto };
    /** Sorted by name. */
    listStories: { body: undefined; response: TStoryListItemDto[] };
    /** The creator gets a grant. The id is a slug of the name, suffixed `-2`, `-3`, … when taken. */
    createStory: { body: TCreateStoryBody; response: TStoryDto };
    /**
     * Under the id in the `?id=` query; the body is the raw zip (`RAW_BODY_ROUTES`). Keeps the zip's
     * password; the importer gets no grant.
     */
    importStory: { body: undefined; response: TStoryDto };

    /** Adds a 24 h grant to the session cookie. `429` after 10 wrong passwords per IP in 10 minutes. */
    login: { body: TLoginBody; response: undefined };
    /** Drops every grant of the session. */
    logout: { body: undefined; response: undefined };
    getSession: { body: undefined; response: TSessionDto };
    /** Needs no grant. */
    getStoryAccess: { body: undefined; response: TStoryAccessDto };

    /** An SSE stream, not JSON. */
    events: { body: undefined; response: never };
    getProject: { body: undefined; response: TProjectDto };

    getStoryInfo: { body: undefined; response: TStoryInfoDto };
    updateStoryInfo: { body: TUpdateStoryBody; response: TStoryInfoDto };
    /** A `<storyId>.zip` attachment, not JSON. */
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

    /** `TEntityListDto<K>` for the requested `kind`. */
    listEntities: { body: undefined; response: TEntityListDto };
    createEntity: { body: TCreateEntityBody; response: TEntityDto };
    getEntity: { body: undefined; response: TEntityDto };
    updateEntity: { body: TUpdateEntityBody; response: TEntityDto };
    deleteEntity: { body: TDeleteEntityBody; response: TOkDto };

    getSource: { body: undefined; response: TSourceDto };
    updateSource: { body: TUpdateSourceBody; response: TSourceDto };

    getImage: { body: undefined; response: TImageDto };
    /** The PNG itself, not JSON. Use `TImageDto.url`. */
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

const fillTemplate = (route: string, template: string, params: Readonly<Record<string, string>>): string =>
    template.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
        const value: string | undefined = params[name];
        if (value === undefined) {
            throw new Error(`buildPath(${route}): missing parameter "${name}"`);
        }
        return encodeURIComponent(value);
    });

/** Parameters are URI-encoded; throws on a missing one. */
export const buildPath = <R extends TStoryRouteName>(storyId: string, route: R, params: TRouteParams<R>): string =>
    storyApiPrefix(storyId) + fillTemplate(route, STORY_ROUTES[route].path, params);

export const buildGlobalPath = <R extends TGlobalRouteName>(route: R, params: TRouteParams<R>): string =>
    fillTemplate(route, GLOBAL_ROUTES[route].path, params);

/** `rest` is what `STORY_ROUTES` paths match. `null` when not below a story or the id does not decode. */
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

/** For `STORY_ROUTES`, `pathname` is the part after the story prefix. */
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

/** Returns the decoded parameters, or `null`. */
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

/** Mutations without a body; still sent as `application/json`: the CSRF check wants it on every mutation. */
export const BODYLESS_ROUTES: readonly TRouteName[] = ['logout'];

/** Not JSON: `importStory` must send `content-type: application/zip` (the CSRF check wants it). */
export const RAW_BODY_ROUTES: readonly TRouteName[] = ['importStory'];

/** `204 No Content`. */
export const NO_CONTENT_ROUTES: readonly TRouteName[] = ['login', 'logout'];

/** `201 Created`. */
export const CREATED_ROUTES: readonly TRouteName[] = [
    'createStory',
    'importStory',
    'createChapter',
    'addChapterCharacter',
    'createPassage',
    'createTrigger',
    'createEntity',
];
