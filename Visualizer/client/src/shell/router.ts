import { action, makeObservable, observable } from 'mobx';
import type { TChapterId } from '@story/types';
import { getUiState, setUiState } from '../ui-state';

/**
 * A tiny typed hash router. The URL hash is the source of truth, so a reload keeps the page.
 *
 *   #/map
 *   #/timeline
 *   #/timeline/chapter/:chapterId
 *   #/entities
 *   #/entities/:kind
 *   #/entities/:kind/:id
 *   #/_canvas                 (dev playground, WP3)
 *
 * Anything else falls back to `DEFAULT_ROUTE`. When the page loads without a hash, the last
 * route of this browser tab (sessionStorage) is restored.
 */

export const ENTITY_KINDS = ['characters', 'locations', 'npcs', 'items'] as const;
export type TEntityKind = (typeof ENTITY_KINDS)[number];

export type TRoute =
    | { page: 'map' }
    | { page: 'timeline' }
    | { page: 'chapter'; chapterId: TChapterId }
    | { page: 'entities'; kind?: TEntityKind; id?: string }
    | { page: 'canvas' };

export type TPage = TRoute['page'];

export const DEFAULT_ROUTE: TRoute = { page: 'map' };

const LAST_ROUTE_KEY = 'shell.lastRoute';

const isEntityKind = (value: string): value is TEntityKind => (ENTITY_KINDS as readonly string[]).includes(value);

const decode = (part: string) => {
    try {
        return decodeURIComponent(part);
    } catch {
        return part;
    }
};

/** Parse a hash (`#/timeline/chapter/village`, with or without `#`). `null` when unknown. */
export const parseHash = (hash: string): TRoute | null => {
    const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
    const parts = path === '' ? [] : path.split('/').map(decode);

    switch (parts[0]) {
        case 'map':
            return parts.length === 1 ? { page: 'map' } : null;
        case 'timeline':
            if (parts.length === 1) return { page: 'timeline' };
            if (parts.length === 3 && parts[1] === 'chapter' && parts[2]) {
                return { page: 'chapter', chapterId: parts[2] as TChapterId };
            }
            return null;
        case 'entities': {
            if (parts.length === 1) return { page: 'entities' };
            const kind = parts[1];
            if (!isEntityKind(kind) || parts.length > 3) return null;
            return parts[2] ? { page: 'entities', kind, id: parts[2] } : { page: 'entities', kind };
        }
        case '_canvas':
            return parts.length === 1 ? { page: 'canvas' } : null;
        default:
            return null;
    }
};

/** The hash for a route, including the leading `#`. */
export const routeToHash = (route: TRoute): string => {
    const enc = encodeURIComponent;
    switch (route.page) {
        case 'map':
            return '#/map';
        case 'timeline':
            return '#/timeline';
        case 'chapter':
            return `#/timeline/chapter/${enc(route.chapterId)}`;
        case 'entities':
            if (!route.kind) return '#/entities';
            return route.id ? `#/entities/${route.kind}/${enc(route.id)}` : `#/entities/${route.kind}`;
        case 'canvas':
            return '#/_canvas';
    }
};

const initialRoute = (): TRoute => {
    if (typeof window === 'undefined') return DEFAULT_ROUTE;
    return parseHash(window.location.hash) ?? parseHash(getUiState<string>(LAST_ROUTE_KEY, '')) ?? DEFAULT_ROUTE;
};

export class Router {
    route: TRoute = initialRoute();
    private started = false;

    constructor() {
        makeObservable(this, {
            route: observable.ref,
            sync: action,
        });
    }

    /** Start listening to `hashchange`. Idempotent. Called by the shell. */
    start = () => {
        if (this.started) return;
        this.started = true;

        if (window.location.hash === '' || window.location.hash === '#') {
            this.replaceHash(this.route);
        }
        this.sync();
        window.addEventListener('hashchange', this.sync);
    };

    stop = () => {
        if (!this.started) return;
        this.started = false;
        window.removeEventListener('hashchange', this.sync);
    };

    /** Go to `route`. `replace` swaps the current history entry instead of pushing one. */
    navigate = (route: TRoute, options: { replace?: boolean } = {}) => {
        const hash = routeToHash(route);
        if (options.replace) {
            this.replaceHash(route);
            this.sync();
        } else if (window.location.hash !== hash) {
            // triggers `hashchange` → `sync`
            window.location.hash = hash;
        }
    };

    /** An `href` for links (`<a href={router.href(route)}>`). */
    href = (route: TRoute) => routeToHash(route);

    /** True when the current page is `page`. */
    is = (page: TPage) => this.route.page === page;

    /** Reads the hash into `route`; unknown hashes are rewritten to the default route. */
    sync = () => {
        const parsed = parseHash(window.location.hash);
        if (parsed === null) {
            this.replaceHash(DEFAULT_ROUTE);
            this.route = DEFAULT_ROUTE;
        } else {
            this.route = parsed;
        }
        setUiState(LAST_ROUTE_KEY, routeToHash(this.route));
    };

    private replaceHash = (route: TRoute) => {
        const url = new URL(window.location.href);
        url.hash = routeToHash(route);
        window.history.replaceState(window.history.state, '', url);
    };
}

/** The app-wide router. Import it anywhere, including from non-React stores. */
export const router = new Router();
