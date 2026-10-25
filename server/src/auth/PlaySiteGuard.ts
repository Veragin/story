import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TRouteName } from '@story/protocol';
import type { Request } from 'express';
import { HttpError } from '../common/HttpError';
import { ProtocolRouteName } from '../common/ProtocolRoute';

// set by the play site's proxy on every request (docker/Caddyfile): story code runs there
export const PLAY_SITE_HEADER = 'x-story-play-site';

export const isPlaySite = (req: Request) => req.headers[PLAY_SITE_HEADER] !== undefined;

export const PLAY_SITE_ROUTES: ReadonlySet<TRouteName> = new Set([
    'listStories',
    'login',
    'getPlayManifest',
    'getPlayFile',
]);

@Injectable()
export class PlaySiteGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        if (!isPlaySite(context.switchToHttp().getRequest<Request>())) return true;
        const route = this.reflector.get(ProtocolRouteName, context.getHandler());
        if (route !== undefined && PLAY_SITE_ROUTES.has(route)) return true;
        throw HttpError.forbidden('Not available on the play site');
    }
}
