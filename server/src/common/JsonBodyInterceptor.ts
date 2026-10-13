import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TRouteName } from '@story/protocol';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { jsonObjectBody, readJsonBody, versionedBody } from './body';
import { ProtocolRouteName } from './ProtocolRoute';
import { isVersionedRoute, takesJsonBody } from './routeBody';

const routeJsonBody = async (route: TRouteName, req: Request): Promise<Record<string, unknown>> => {
    const body = jsonObjectBody(await readJsonBody(req));
    return isVersionedRoute(route) ? versionedBody(body) : body;
};

// the app runs without Nest's body parser, so a body is read only after the guards (CSRF first) let it in
@Injectable()
export class JsonBodyInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
        const route = this.reflector.get(ProtocolRouteName, context.getHandler());
        if (route !== undefined && takesJsonBody(route)) {
            const req = context.switchToHttp().getRequest<Request>();
            req.body = await routeJsonBody(route, req);
        }
        return next.handle();
    }
}
