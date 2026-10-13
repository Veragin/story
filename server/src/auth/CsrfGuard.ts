import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ProtocolRouteName } from '../common/ProtocolRoute';
import { AUTH_OPTIONS, type TAuthOptions } from './authOptions';
import { assertSafeMutation } from './csrf';

@Injectable()
export class CsrfGuard implements CanActivate {
    private readonly allowedOrigins: ReadonlySet<string>;

    constructor(
        private readonly reflector: Reflector,
        @Inject(AUTH_OPTIONS) options: TAuthOptions
    ) {
        this.allowedOrigins = new Set(options.allowedOrigins);
    }

    canActivate(context: ExecutionContext): boolean {
        const route = this.reflector.get(ProtocolRouteName, context.getHandler());
        if (route !== undefined)
            assertSafeMutation(context.switchToHttp().getRequest<Request>(), this.allowedOrigins, route);
        return true;
    }
}
