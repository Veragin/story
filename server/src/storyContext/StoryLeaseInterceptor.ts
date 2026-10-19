import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isStoryRouteName, STORY_ID_PARAM } from '@story/protocol';
import type { Request } from 'express';
import { defer, finalize, mergeMap, type Observable } from 'rxjs';
import { ProtocolRouteName } from '../common/ProtocolRoute';
import { attachStoryContext } from './requestStoryContext';
import { StoryContexts } from './StoryContexts';

// a long-lived response (the event stream) keeps its lease by not settling until the response closes
@Injectable()
export class StoryLeaseInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly contexts: StoryContexts
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const route = this.reflector.get(ProtocolRouteName, context.getHandler());
        if (route === undefined || !isStoryRouteName(route)) return next.handle();
        const req = context.switchToHttp().getRequest<Request>();
        const storyId = req.params[STORY_ID_PARAM];
        if (typeof storyId !== 'string') throw new Error(`${route}: no path parameter "${STORY_ID_PARAM}"`);
        return defer(() => this.contexts.acquire(storyId)).pipe(
            mergeMap((lease) => {
                attachStoryContext(req, lease.ctx);
                return next.handle().pipe(finalize(lease.release));
            })
        );
    }
}
