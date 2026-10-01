import { keysOf } from '@story/shared';
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
import { errorMessage, HttpError, isHttpError } from './HttpError';
import { isPlainObject, readJsonBody } from './body';

export const RAW_RESPONSE = Symbol('raw-response');

export type TRouteContext<R extends TRouteName> = {
    route: R;
    params: TRouteParams<R>;
    query: URLSearchParams;
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

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    if (res.headersSent) {
        res.end();
        return;
    }
    res.writeHead(status, JSON_HEADERS);
    res.end(JSON.stringify(body) + '\n');
};

export const sendError = (res: ServerResponse, e: unknown) => {
    if (isHttpError(e)) {
        sendJson(res, e.status, e.body);
        return;
    }
    console.error('[visualizer-server] unhandled error', e);
    const body: TApiErrorBody = { error: 'internal', message: errorMessage(e) };
    sendJson(res, 500, body);
};

type TEntry = { route: TRouteName; handler: TRouteHandler<TRouteName> };

export class Router<N extends TRouteName = TRouteName> {
    private readonly entries = new Map<N, TEntry>();
    private readonly bodyRoutes: Set<N>;

    constructor(private readonly table: TRouteTable<N>) {
        this.bodyRoutes = new Set(
            keysOf(table).filter(
                (r) => table[r].method !== 'GET' && !BODYLESS_ROUTES.includes(r) && !RAW_BODY_ROUTES.includes(r)
            )
        );
    }

    handle<R extends N>(route: R, handler: TRouteHandler<R>): this {
        this.entries.set(route, { route, handler: handler as unknown as TRouteHandler<TRouteName> });
        return this;
    }

    missing(): N[] {
        return keysOf(this.table).filter((r) => !this.entries.has(r));
    }

    assertComplete(): void {
        const missing = this.missing();
        if (missing.length > 0) {
            throw new Error(`Protocol routes without a handler: ${missing.join(', ')}`);
        }
    }

    match(method: string, pathname: string): { route: N; params: Record<string, string> } | null {
        return matchRoute(this.table, method, pathname);
    }

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
