import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    BODYLESS_ROUTES,
    CREATED_ROUTES,
    matchRoute,
    NO_CONTENT_ROUTES,
    RAW_BODY_ROUTES,
    type TApiErrorBody,
    type TRouteBody,
    type TRouteName,
    type TRouteParams,
    type TRouteResponse,
    type TRouteTable,
} from '@story/visualizer-protocol';
import { HttpError, isHttpError } from './HttpError';
import { isPlainObject, readJsonBody } from './body';

/** Return this from a handler that wrote the response itself (the SSE stream). */
export const RAW_RESPONSE = Symbol('raw-response');

export type TRouteContext<R extends TRouteName> = {
    route: R;
    params: TRouteParams<R>;
    query: URLSearchParams;
    /**
     * The parsed JSON body. Its shape is the protocol's, but it came off the wire: validate what
     * you read (`requireString`, …). For PUT / DELETE the router has already checked that it is an
     * object with a string `version`; for POST that it is an object (when the route takes one).
     * `RAW_BODY_ROUTES` get `undefined`: their handler reads `req` itself.
     */
    body: TRouteBody<R>;
    req: IncomingMessage;
    res: ServerResponse;
};

export type TRouteHandler<R extends TRouteName> = (
    ctx: TRouteContext<R>
) => Promise<TRouteResponse<R> | typeof RAW_RESPONSE> | TRouteResponse<R> | typeof RAW_RESPONSE;

const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
};

export const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    if (res.headersSent) {
        res.end();
        return;
    }
    res.writeHead(status, JSON_HEADERS);
    res.end(JSON.stringify(body) + '\n');
};

/** Answer an error: an `HttpError` as its status + body, anything else as `500 internal`. */
export const sendError = (res: ServerResponse, e: unknown) => {
    if (isHttpError(e)) {
        sendJson(res, e.status, e.body);
        return;
    }
    console.error('[visualizer-server] unhandled error', e);
    const body: TApiErrorBody = { error: 'internal', message: (e as Error)?.message ?? String(e) };
    sendJson(res, 500, body);
};

type TEntry = { route: TRouteName; handler: TRouteHandler<TRouteName> };

/**
 * A tiny router over one of the protocol's route tables (`STORY_ROUTES` for a story's router,
 * `GLOBAL_ROUTES` for the app's). Handlers are registered by *route name*, so the method, path
 * template, params, body and response types all come from `@story/visualizer-protocol` and cannot
 * drift:
 *
 *     router.handle('getChapter', async ({ params }) => readChapter(params.chapterId));
 *
 * A handler returns the response DTO (sent as JSON, 200 — or 201 for `create*` routes, or 204 and
 * nothing for `NO_CONTENT_ROUTES`) or throws an `HttpError` (sent as its status +
 * `TApiErrorBody`). Any other exception is a 500. Headers a handler sets with `res.setHeader`
 * (`set-cookie`) go out with the answer.
 */
export class Router<N extends TRouteName = TRouteName> {
    private readonly entries = new Map<N, TEntry>();
    /** Routes that take a JSON body: every non-GET one except `BODYLESS_ROUTES` and `RAW_BODY_ROUTES`. */
    private readonly bodyRoutes: Set<N>;

    constructor(private readonly table: TRouteTable<N>) {
        this.bodyRoutes = new Set(
            (Object.keys(table) as N[]).filter(
                (r) => table[r].method !== 'GET' && !BODYLESS_ROUTES.includes(r) && !RAW_BODY_ROUTES.includes(r)
            )
        );
    }

    /** Register (or replace) the handler of a protocol route. */
    handle<R extends N>(route: R, handler: TRouteHandler<R>): this {
        this.entries.set(route, { route, handler: handler as unknown as TRouteHandler<TRouteName> });
        return this;
    }

    has(route: N) {
        return this.entries.has(route);
    }

    /** Routes of the table that have no handler — should be empty once every file registers its own. */
    missing(): N[] {
        return (Object.keys(this.table) as N[]).filter((r) => !this.entries.has(r));
    }

    /** Find the route for a method + pathname. */
    match(method: string, pathname: string): { route: N; params: Record<string, string> } | null {
        return matchRoute(this.table, method, pathname);
    }

    /**
     * The node:http request listener. Never rejects. `pathname` is what the table's paths are
     * matched against; it defaults to the request's own. The app's dispatcher passes a story
     * router the part after `/api/stories/:storyId`.
     */
    dispatch = async (req: IncomingMessage, res: ServerResponse, pathname?: string): Promise<void> => {
        try {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const found = this.match(req.method ?? 'GET', pathname ?? url.pathname);
            if (!found) {
                throw HttpError.notFound(`No route ${req.method} ${url.pathname}`);
            }
            const entry = this.entries.get(found.route);
            if (!entry) {
                throw HttpError.notImplemented(`${found.route} has no handler`);
            }

            let body: unknown = undefined;
            if (this.bodyRoutes.has(found.route)) {
                body = await readJsonBody(req);
                if (!isPlainObject(body)) {
                    throw HttpError.badRequest('Expected a JSON object body');
                }
                const method = this.table[found.route].method;
                if ((method === 'PUT' || method === 'DELETE') && typeof body.version !== 'string') {
                    throw HttpError.badRequest('Field "version" must be a string (the version the change is based on)');
                }
            }

            const result = await entry.handler({
                route: found.route,
                params: found.params as TRouteParams<TRouteName>,
                query: url.searchParams,
                body: body as TRouteBody<TRouteName>,
                req,
                res,
            });
            if (result === RAW_RESPONSE) return;
            if (NO_CONTENT_ROUTES.includes(found.route)) {
                res.writeHead(204, { 'cache-control': 'no-store' });
                res.end();
                return;
            }
            sendJson(res, CREATED_ROUTES.includes(found.route) ? 201 : 200, result);
        } catch (e) {
            sendError(res, e);
        }
    };
}
