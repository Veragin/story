import { keysOf } from '@story/shared';
import type {
    TAddChapterCharacterBody,
    TChapterDto,
    TCreateChapterBody,
    TDeleteChapterBody,
    TRemoveChapterCharacterBody,
    TUpdateChapterBody,
} from './dto/chapter';
import type { TOkDto } from './dto/common';
import type { TEngineSection, TEngineSectionDto, TUpdateEngineSectionBody } from './dto/engine';
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
import type {
    TDeleteGitBranchBody,
    TDeleteGitConfigBody,
    TGitBranchDto,
    TGitCheckoutBody,
    TGitCommitBody,
    TGitCommitResultDto,
    TGitDto,
    TGitLogEntryDto,
    TGitPullResultDto,
    TGitStatusDto,
    TSetupGitBody,
    TUpdateGitConfigBody,
} from './dto/git';
import type { TDeleteMapBody, TMapDto, TUpdateMapBody } from './dto/map';
import type {
    TChapterPassagesDto,
    TCreatePassageBody,
    TDeletePassageBody,
    TPassageDto,
    TUpdatePassageBody,
} from './dto/passage';
import type { TDeleteImageBody, TImageDto, TImageOwner, TUploadImageBody } from './dto/image';
import type { TPlayManifestDto } from './dto/play';
import type { THealthDto, TProjectDto } from './dto/project';
import type { TSourceDto, TSourceOwner, TUpdateSourceBody } from './dto/source';
import type {
    TAddLiteralValueBody,
    TCatalogEntryDto,
    TCatalogListDto,
    TClearedReferencesDto,
    TCreateCatalogEntryBody,
    TCreateLiteralBody,
    TCreateTypeBody,
    TDeleteCatalogEntryBody,
    TDeleteLiteralBody,
    TDeleteReferencesDto,
    TDeleteTypeBody,
    TLiteralDto,
    TStructTypeDto,
    TStructureDto,
    TUpdateCatalogEntryBody,
    TUpdateLiteralBody,
    TUpdateTypeBody,
    TUpdateTypeDto,
} from './dto/structure';
import type {
    TCreateStoryBody,
    TImportStoryBody,
    TEditStoryInfoDto,
    TLoginBody,
    TRequestPasswordResetBody,
    TResetPasswordBody,
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
 * absolute and matched first, so a global route may live below a story (`login`, `getStoryAccess`,
 * `requestPasswordReset`, `resetPassword`: the only ones there that need no grant).
 */
export const API_PREFIX = '/api';

export const STORIES_PREFIX = `${API_PREFIX}/stories`;

export type THttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const storyApiPrefix = (storyId: string) => `${STORIES_PREFIX}/${encodeURIComponent(storyId)}`;

/**
 * Who may call a route (D3). `public`: anyone. `read`: a grant for the story, or the story is public.
 * `write`: a grant for the story. Story mutations are always `write`; a story `GET` is `read` unless
 * only editors may see it (git config and status).
 */
export type TRouteAccess = 'public' | 'read' | 'write';

export type TRouteDef = { readonly method: THttpMethod; readonly path: string; readonly access: TRouteAccess };

type TStoryRouteDef =
    | { method: 'GET'; path: `/${string}`; access: 'read' | 'write' }
    | { method: Exclude<THttpMethod, 'GET'>; path: `/${string}`; access: 'write' };

export const STORY_ROUTES = {
    events: { method: 'GET', path: '/events', access: 'read' },
    getProject: { method: 'GET', path: '/project', access: 'read' },

    getStoryInfo: { method: 'GET', path: '/info', access: 'read' },
    updateStoryInfo: { method: 'PUT', path: '/info', access: 'write' },
    exportStory: { method: 'GET', path: '/export', access: 'read' },
    exportPlayable: { method: 'GET', path: '/export/web', access: 'read' },
    addStoryFiles: { method: 'POST', path: '/files', access: 'write' },

    createChapter: { method: 'POST', path: '/chapters', access: 'write' },
    getChapter: { method: 'GET', path: '/chapters/:chapterId', access: 'read' },
    updateChapter: { method: 'PUT', path: '/chapters/:chapterId', access: 'write' },
    deleteChapter: { method: 'DELETE', path: '/chapters/:chapterId', access: 'write' },
    addChapterCharacter: { method: 'POST', path: '/chapters/:chapterId/characters', access: 'write' },
    removeChapterCharacter: { method: 'DELETE', path: '/chapters/:chapterId/characters/:characterId', access: 'write' },

    listChapterPassages: { method: 'GET', path: '/chapters/:chapterId/passages', access: 'read' },
    createPassage: { method: 'POST', path: '/chapters/:chapterId/passages', access: 'write' },
    getPassage: { method: 'GET', path: '/passages/:passageId', access: 'read' },
    updatePassage: { method: 'PUT', path: '/passages/:passageId', access: 'write' },
    deletePassage: { method: 'DELETE', path: '/passages/:passageId', access: 'write' },

    createTrigger: { method: 'POST', path: '/chapters/:chapterId/triggers', access: 'write' },
    getTrigger: { method: 'GET', path: '/triggers/:triggerId', access: 'read' },
    updateTrigger: { method: 'PUT', path: '/triggers/:triggerId', access: 'write' },
    deleteTrigger: { method: 'DELETE', path: '/triggers/:triggerId', access: 'write' },

    listEntities: { method: 'GET', path: '/entities/:kind', access: 'read' },
    createEntity: { method: 'POST', path: '/entities/:kind', access: 'write' },
    getEntity: { method: 'GET', path: '/entities/:kind/:id', access: 'read' },
    updateEntity: { method: 'PUT', path: '/entities/:kind/:id', access: 'write' },
    deleteEntity: { method: 'DELETE', path: '/entities/:kind/:id', access: 'write' },
    getEntityReferences: { method: 'GET', path: '/entities/:kind/:id/references', access: 'read' },

    listCatalogEntries: { method: 'GET', path: '/catalogs/:name', access: 'read' },
    createCatalogEntry: { method: 'POST', path: '/catalogs/:name', access: 'write' },
    getCatalogEntry: { method: 'GET', path: '/catalogs/:name/:id', access: 'read' },
    updateCatalogEntry: { method: 'PUT', path: '/catalogs/:name/:id', access: 'write' },
    deleteCatalogEntry: { method: 'DELETE', path: '/catalogs/:name/:id', access: 'write' },
    getCatalogEntryReferences: { method: 'GET', path: '/catalogs/:name/:id/references', access: 'read' },

    getStructure: { method: 'GET', path: '/structure', access: 'read' },
    createType: { method: 'POST', path: '/structure/types', access: 'write' },
    updateType: { method: 'PUT', path: '/structure/types/:name', access: 'write' },
    deleteType: { method: 'DELETE', path: '/structure/types/:name', access: 'write' },
    createLiteral: { method: 'POST', path: '/structure/literals', access: 'write' },
    updateLiteral: { method: 'PUT', path: '/structure/literals/:name', access: 'write' },
    addLiteralValue: { method: 'POST', path: '/structure/literals/:name/values', access: 'write' },
    deleteLiteral: { method: 'DELETE', path: '/structure/literals/:name', access: 'write' },

    getSource: { method: 'GET', path: '/source/:owner/:id', access: 'read' },
    updateSource: { method: 'PUT', path: '/source/:owner/:id', access: 'write' },

    getEngineSection: { method: 'GET', path: '/engine/:section', access: 'read' },
    updateEngineSection: { method: 'PUT', path: '/engine/:section', access: 'write' },

    getImage: { method: 'GET', path: '/images/:owner/:id', access: 'read' },
    getImageFile: { method: 'GET', path: '/images/:owner/:id/png', access: 'read' },
    uploadImage: { method: 'PUT', path: '/images/:owner/:id', access: 'write' },
    deleteImage: { method: 'DELETE', path: '/images/:owner/:id', access: 'write' },

    getPlayManifest: { method: 'GET', path: '/play', access: 'read' },
    getPlayFile: { method: 'GET', path: '/play/:file', access: 'read' },

    getMap: { method: 'GET', path: '/maps/:mapId', access: 'read' },
    updateMap: { method: 'PUT', path: '/maps/:mapId', access: 'write' },
    deleteMap: { method: 'DELETE', path: '/maps/:mapId', access: 'write' },

    getTimelineLayout: { method: 'GET', path: '/layout/timeline', access: 'read' },
    updateTimelineLayout: { method: 'PUT', path: '/layout/timeline', access: 'write' },
    getChapterLayout: { method: 'GET', path: '/layout/chapters/:chapterId', access: 'read' },
    updateChapterLayout: { method: 'PUT', path: '/layout/chapters/:chapterId', access: 'write' },

    getGit: { method: 'GET', path: '/git', access: 'write' },
    updateGitConfig: { method: 'PUT', path: '/git/config', access: 'write' },
    setupGit: { method: 'POST', path: '/git/setup', access: 'write' },
    deleteGitConfig: { method: 'DELETE', path: '/git/config', access: 'write' },
    gitFetch: { method: 'POST', path: '/git/fetch', access: 'write' },
    gitCommit: { method: 'POST', path: '/git/commit', access: 'write' },
    gitPush: { method: 'POST', path: '/git/push', access: 'write' },
    gitForcePush: { method: 'POST', path: '/git/push/force', access: 'write' },
    gitPull: { method: 'POST', path: '/git/pull', access: 'write' },
    gitCheckout: { method: 'POST', path: '/git/checkout', access: 'write' },
    gitDiscard: { method: 'POST', path: '/git/discard', access: 'write' },
    getGitBranches: { method: 'GET', path: '/git/branches', access: 'write' },
    deleteGitBranch: { method: 'POST', path: '/git/branches/delete', access: 'write' },
    getGitLog: { method: 'GET', path: '/git/log', access: 'write' },
} as const satisfies Record<string, TStoryRouteDef>;

export const GLOBAL_ROUTES = {
    health: { method: 'GET', path: '/api/health', access: 'public' },
    listStories: { method: 'GET', path: '/api/stories', access: 'public' },
    createStory: { method: 'POST', path: '/api/stories', access: 'public' },
    importStory: { method: 'POST', path: '/api/stories/import', access: 'public' },

    login: { method: 'POST', path: '/api/stories/:storyId/login', access: 'public' },
    logout: { method: 'POST', path: '/api/logout', access: 'public' },
    getSession: { method: 'GET', path: '/api/session', access: 'public' },
    getStoryAccess: { method: 'GET', path: '/api/stories/:storyId/access', access: 'public' },
    requestPasswordReset: { method: 'POST', path: '/api/stories/:storyId/password-reset', access: 'public' },
    resetPassword: { method: 'PUT', path: '/api/stories/:storyId/password-reset', access: 'public' },
} as const satisfies Record<
    string,
    { method: THttpMethod; path: `${typeof API_PREFIX}/${string}`; access: TRouteAccess }
>;

export type TStoryRouteName = keyof typeof STORY_ROUTES;
export type TGlobalRouteName = keyof typeof GLOBAL_ROUTES;
export type TRouteName = TStoryRouteName | TGlobalRouteName;

export type TRouteTable<N extends TRouteName = TRouteName> = { readonly [K in N]: TRouteDef };

type TAllRoutes = typeof STORY_ROUTES & typeof GLOBAL_ROUTES;

export const STORY_ROUTE_NAMES: readonly TStoryRouteName[] = keysOf(STORY_ROUTES);
export const GLOBAL_ROUTE_NAMES: readonly TGlobalRouteName[] = keysOf(GLOBAL_ROUTES);
export const ROUTE_NAMES: readonly TRouteName[] = [...STORY_ROUTE_NAMES, ...GLOBAL_ROUTE_NAMES];

export const isRouteName = (value: string): value is TRouteName =>
    Object.prototype.hasOwnProperty.call(STORY_ROUTES, value) ||
    Object.prototype.hasOwnProperty.call(GLOBAL_ROUTES, value);

export const isStoryRouteName = (route: TRouteName): route is TStoryRouteName =>
    Object.prototype.hasOwnProperty.call(STORY_ROUTES, route);

export const routeDef = (route: TRouteName): TRouteDef =>
    isStoryRouteName(route) ? STORY_ROUTES[route] : GLOBAL_ROUTES[route];

/** The story id parameter of `routeTemplate` for `STORY_ROUTES`. */
export const STORY_ID_PARAM = 'storyId';

/** The absolute path with `:name` parameters; `STORY_ROUTES` get `/api/stories/:storyId` in front. */
export const routeTemplate = (route: TRouteName): string =>
    isStoryRouteName(route)
        ? `${STORIES_PREFIX}/:${STORY_ID_PARAM}${STORY_ROUTES[route].path}`
        : GLOBAL_ROUTES[route].path;

/** The `:name` parameters of a path template, in order. */
export const templateParams = (template: string): string[] =>
    Array.from(template.matchAll(/:([A-Za-z]+)/g), (match) => match[1]);

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
          : K extends 'section'
            ? TEngineSection
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
     * A `multipart/form-data` form (`STORY_IMPORT_CONTENT_TYPE`, build it with `storyImportForm`): the zip in
     * `STORY_IMPORT_ZIP_FIELD` plus the `TImportStoryBody` fields. The map size comes from the zip's
     * `data/locations/map.json`; a `story.json` in the zip is ignored. Id and grant as for `createStory`.
     */
    importStory: { body: TImportStoryBody; response: TStoryDto };

    /** Adds a 24 h grant to the session cookie. `429` after 10 wrong passwords per IP in 10 minutes. */
    login: { body: TLoginBody; response: undefined };
    /** Drops every grant of the session. */
    logout: { body: undefined; response: undefined };
    getSession: { body: undefined; response: TSessionDto };
    /** Needs no grant. */
    getStoryAccess: { body: undefined; response: TStoryAccessDto };
    /**
     * Mails a link (`PASSWORD_RESET_TOKEN_PARAM`) valid for 12 h when `email` is the story's; a newer link
     * replaces the older one. Otherwise, or when the story has no email, `400` after a 1 s delay.
     * `429` after 5 requests per IP and story in 15 minutes; every request counts.
     */
    requestPasswordReset: { body: TRequestPasswordResetBody; response: undefined };
    /**
     * Sets the password, revokes every grant for the story and adds a grant like `login`.
     * `400` for an unknown or expired token.
     */
    resetPassword: { body: TResetPasswordBody; response: undefined };

    /** An SSE stream, not JSON. */
    events: { body: undefined; response: never };
    getProject: { body: undefined; response: TProjectDto };

    /** `TPublicStoryInfoDto` without a grant (a public story), else `TEditStoryInfoDto`. */
    getStoryInfo: { body: undefined; response: TStoryInfoDto };
    /** `stale` carries a `TEditStoryInfoDto` as `current`. */
    updateStoryInfo: { body: TUpdateStoryBody; response: TEditStoryInfoDto };
    /** A `<storyId>.zip` attachment, not JSON. */
    exportStory: { body: undefined; response: never };
    /** A `<storyId>-web.zip` attachment, not JSON: the standalone player, `play.json`, `data/` and `types/`. */
    exportPlayable: { body: undefined; response: never };
    /**
     * A `multipart/form-data` form (build it with `storyFilesForm`): a story zip in `STORY_IMPORT_ZIP_FIELD`,
     * shaped like an `exportStory` zip. Its files are added to the story, replacing those of the same path;
     * its `tsconfig.json` and `story.json` are ignored. A `map.json` in it sets the map size.
     */
    addStoryFiles: { body: undefined; response: TOkDto };

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
    /** Clears the value references to it (see `TClearedReferenceDto`); `409 referenced` while code still uses it. */
    deleteEntity: { body: TDeleteEntityBody; response: TClearedReferencesDto };
    /** A dry run of `deleteEntity`: nothing is written. */
    getEntityReferences: { body: undefined; response: TDeleteReferencesDto };

    /** The entries of `data/catalogs/<name>.ts`, in file order. */
    listCatalogEntries: { body: undefined; response: TCatalogListDto };
    createCatalogEntry: { body: TCreateCatalogEntryBody; response: TCatalogEntryDto };
    getCatalogEntry: { body: undefined; response: TCatalogEntryDto };
    /** `values` replaces every value: a key left out is removed. */
    updateCatalogEntry: { body: TUpdateCatalogEntryBody; response: TCatalogEntryDto };
    /** Clears the value references to it, as `deleteEntity` does. */
    deleteCatalogEntry: { body: TDeleteCatalogEntryBody; response: TClearedReferencesDto };
    /** A dry run of `deleteCatalogEntry`: nothing is written. */
    getCatalogEntryReferences: { body: undefined; response: TDeleteReferencesDto };

    /** The story's literals and types. */
    getStructure: { body: undefined; response: TStructureDto };
    /** `types/<name>.ts` plus its barrel line; with `catalog`, also `data/catalogs/<catalog.name>.ts`. */
    createType: { body: TCreateTypeBody; response: TStructTypeDto };
    /** Also rewrites every instance (renames, removals, defaults); `touchedFiles` lists them. */
    updateType: { body: TUpdateTypeBody; response: TUpdateTypeDto };
    /** Story types only; `409 referenced` while used or while its catalog has entries. */
    deleteType: { body: TDeleteTypeBody; response: TOkDto };
    createLiteral: { body: TCreateLiteralBody; response: TLiteralDto };
    /** Renames rewrite the values typed by the literal; removing a used value is `409 referenced`. */
    updateLiteral: { body: TUpdateLiteralBody; response: TLiteralDto };
    /** `409 exists` when the value is already a member. */
    addLiteralValue: { body: TAddLiteralValueBody; response: TLiteralDto };
    deleteLiteral: { body: TDeleteLiteralBody; response: TOkDto };

    getSource: { body: undefined; response: TSourceDto };
    updateSource: { body: TUpdateSourceBody; response: TSourceDto };

    /** A missing file answers `exists: false`, `version: ''` and an empty `description` and `code`. */
    getEngineSection: { body: undefined; response: TEngineSectionDto };
    /**
     * Creates the file when missing, plus its entry in `data/engine/index.ts` (and that file, and
     * `export * from './engine'` in `data/index.ts`). `delete: true` removes both and answers the
     * missing section.
     */
    updateEngineSection: { body: TUpdateEngineSectionBody; response: TEngineSectionDto };

    getImage: { body: undefined; response: TImageDto };
    /** The PNG itself, not JSON. Use `TImageDto.url`. */
    getImageFile: { body: undefined; response: never };
    uploadImage: { body: TUploadImageBody; response: TImageDto };
    /** Answers the image as it is now: none. Deleting a missing image (`version: ''`) changes nothing. */
    deleteImage: { body: TDeleteImageBody; response: TImageDto };

    getPlayManifest: { body: undefined; response: TPlayManifestDto };
    /**
     * A file of `TPlayManifestDto.files`, not JSON; `:file` is its story-relative path. `ETag` is its
     * version, `cache-control: no-cache` (stories are edited live).
     */
    getPlayFile: { body: undefined; response: never };

    getMap: { body: undefined; response: TMapDto };
    updateMap: { body: TUpdateMapBody; response: TMapDto };
    /** A location's map only; `global` cannot be deleted. */
    deleteMap: { body: TDeleteMapBody; response: TOkDto };

    getTimelineLayout: { body: undefined; response: TTimelineLayoutDto };
    updateTimelineLayout: { body: TUpdateTimelineLayoutBody; response: TTimelineLayoutDto };
    getChapterLayout: { body: undefined; response: TChapterLayoutDto };
    updateChapterLayout: { body: TUpdateChapterLayoutBody; response: TChapterLayoutDto };

    /** `available: false` without `GIT_TOKEN_KEY` or `git` on the server. Does not fetch. */
    getGit: { body: undefined; response: TGitDto };
    updateGitConfig: { body: TUpdateGitConfigBody; response: TGitDto };
    setupGit: { body: TSetupGitBody; response: TGitDto };
    /** `removeRepo: false` keeps the story's `.git` folder. */
    deleteGitConfig: { body: TDeleteGitConfigBody; response: undefined };
    /** Refreshes `ahead` / `behind` and the remote branches. */
    gitFetch: { body: undefined; response: TGitStatusDto };
    /** Stages everything; `409 git_nothing_to_commit` on a clean tree. A failed push keeps the commit. */
    gitCommit: { body: TGitCommitBody; response: TGitCommitResultDto };
    /** `409 git_rejected` when the remote is ahead. */
    gitPush: { body: undefined; response: TGitStatusDto };
    /** Overwrites the remote branch with the local one. */
    gitForcePush: { body: undefined; response: TGitStatusDto };
    /** Fetch + merge; `409 git_dirty` with uncommitted changes, `409 git_conflict` (merge aborted) on a conflict. */
    gitPull: { body: undefined; response: TGitPullResultDto };
    /** Switching (not creating) answers `409 git_dirty` with uncommitted changes. */
    gitCheckout: { body: TGitCheckoutBody; response: TGitStatusDto };
    /** Drops every uncommitted change, untracked files included (ignored ones stay). */
    gitDiscard: { body: undefined; response: TGitStatusDto };
    /** Local and `origin` branches as of the last fetch, newest commit first. */
    getGitBranches: { body: undefined; response: TGitBranchDto[] };
    deleteGitBranch: { body: TDeleteGitBranchBody; response: TGitStatusDto };
    /** Newest first; query `TGitLogQuery`. */
    getGitLog: { body: undefined; response: TGitLogEntryDto[] };
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
export const BODYLESS_ROUTES: readonly TRouteName[] = [
    'logout',
    'gitFetch',
    'gitPush',
    'gitForcePush',
    'gitPull',
    'gitDiscard',
];

/** `204 No Content`. */
export const NO_CONTENT_ROUTES: readonly TRouteName[] = [
    'login',
    'logout',
    'requestPasswordReset',
    'resetPassword',
    'deleteGitConfig',
];

/** `201 Created`. */
export const CREATED_ROUTES: readonly TRouteName[] = [
    'createStory',
    'importStory',
    'createChapter',
    'addChapterCharacter',
    'createPassage',
    'createTrigger',
    'createEntity',
    'createCatalogEntry',
    'createType',
    'createLiteral',
    'setupGit',
];
