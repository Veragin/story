import type { IncomingMessage, ServerResponse } from 'node:http';
import {
    CREATED_ROUTES,
    matchPath,
    ROUTES,
    type TApiErrorBody,
    type TRouteBody,
    type TRouteName,
    type TRouteParams,
    type TRouteResponse,
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
     */
    body: TRouteBody<R>;
    req: IncomingMessage;
    res: ServerResponse;
};

export type TRouteHandler<R extends TRouteName> = (
    ctx: TRouteContext<R>
) => Promise<TRouteResponse<R> | typeof RAW_RESPONSE> | TRouteResponse<R> | typeof RAW_RESPONSE;

/** Methods whose protocol route takes a JSON body. */
const BODY_ROUTES = new Set<TRouteName>(
    (Object.keys(ROUTES) as TRouteName[]).filter((r) => ROUTES[r].method !== 'GET' && !r.startsWith('open'))
);

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

type TEntry = { route: TRouteName; handler: TRouteHandler<TRouteName> };

/**
 * A tiny router over the protocol's `ROUTES` table. Handlers are registered by *route name*, so
 * the method, path template, params, body and response types all come from
 * `@story/visualizer-protocol` and cannot drift:
 *
 *     router.handle('getChapter', async ({ params }) => readChapter(params.chapterId));
 *
 * A handler returns the response DTO (sent as JSON, 200 — or 201 for `create*` routes) or throws
 * an `HttpError` (sent as its status + `TApiErrorBody`). Any other exception is a 500.
 */
export class Router {
    private readonly entries = new Map<TRouteName, TEntry>();

    /** Register (or replace) the handler of a protocol route. */
    handle<R extends TRouteName>(route: R, handler: TRouteHandler<R>): this {
        this.entries.set(route, { route, handler: handler as unknown as TRouteHandler<TRouteName> });
        return this;
    }

    has(route: TRouteName) {
        return this.entries.has(route);
    }

    /** Protocol routes that have no handler — should be empty once every file registers its stubs. */
    missing(): TRouteName[] {
        return (Object.keys(ROUTES) as TRouteName[]).filter((r) => !this.entries.has(r));
    }

    /** Find the route for a method + pathname. */
    match(method: string, pathname: string): { route: TRouteName; params: Record<string, string> } | null {
        for (const route of Object.keys(ROUTES) as TRouteName[]) {
            const def = ROUTES[route];
            if (def.method !== method) continue;
            const params = matchPath(def.path, pathname);
            if (params) return { route, params };
        }
        return null;
    }

    /** The node:http request listener. Never rejects. */
    dispatch = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        try {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const found = this.match(req.method ?? 'GET', url.pathname);
            if (!found) {
                throw HttpError.notFound(`No route ${req.method} ${url.pathname}`);
            }
            const entry = this.entries.get(found.route);
            if (!entry) {
                throw HttpError.notImplemented(`${found.route} has no handler`);
            }

            let body: unknown = undefined;
            if (BODY_ROUTES.has(found.route)) {
                body = await readJsonBody(req);
                if (!isPlainObject(body)) {
                    throw HttpError.badRequest('Expected a JSON object body');
                }
                const method = ROUTES[found.route].method;
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
            sendJson(res, CREATED_ROUTES.includes(found.route) ? 201 : 200, result);
        } catch (e) {
            if (isHttpError(e)) {
                sendJson(res, e.status, e.body);
                return;
            }
            console.error('[visualizer-server] unhandled error', e);
            const body: TApiErrorBody = { error: 'internal', message: (e as Error)?.message ?? String(e) };
            sendJson(res, 500, body);
        }
    };
}
