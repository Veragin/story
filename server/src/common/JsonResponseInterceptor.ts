import { HttpStatus, Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { JSON_HEADERS, jsonText } from './jsonResponse';
import { ProtocolRouteName, routeStatus } from './ProtocolRoute';

@Injectable()
export class JsonResponseInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const route = this.reflector.get(ProtocolRouteName, context.getHandler());
        if (route === undefined) return next.handle();
        const res = context.switchToHttp().getResponse<Response>();
        const noContent = routeStatus(route) === HttpStatus.NO_CONTENT;
        return next.handle().pipe(
            map((value: unknown) => {
                // a raw response (image, zip, event stream) already wrote its own headers
                if (res.headersSent) return value;
                res.setHeader('cache-control', JSON_HEADERS['cache-control']);
                if (noContent) return value;
                res.setHeader('content-type', JSON_HEADERS['content-type']);
                return jsonText(value);
            })
        );
    }
}
