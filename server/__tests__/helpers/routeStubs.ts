import { Controller, Req, type Type } from '@nestjs/common';
import { routeTemplate, STORY_ID_PARAM, type TRouteName } from '@story/protocol';
import type { Request } from 'express';
import { storyGrantOf } from '../../src/auth/storyGrant';
import { NOT_YET_PORTED_ROUTES } from '../../src/common/notYetPortedRoutes';
import { ProtocolRoute } from '../../src/common/ProtocolRoute';

export type TStubAnswer = { route: TRouteName; grant: { expiresAt: number } | null };

// one controller with a real @ProtocolRoute handler per route, answering which route ran and its grant
export const routeStubs = (routes: readonly TRouteName[]): Type => {
    @Controller()
    class RouteStubs {}
    const prototype: object = RouteStubs.prototype;
    for (const route of routes) {
        const handler = (req: Request): TStubAnswer => ({ route, grant: storyGrantOf(req) ?? null });
        Object.defineProperty(prototype, route, { value: handler, writable: true, configurable: true });
        Req()(prototype, route, 0);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, route);
        if (descriptor) ProtocolRoute(route)(prototype, route, descriptor);
    }
    return RouteStubs;
};

// stubs the given routes where no real handler exists yet, and lets the route check know
export const stubbedApp = (routes: readonly TRouteName[]) => {
    const stubbed = routes.filter((route) => NOT_YET_PORTED_ROUTES.includes(route));
    return {
        stubbed,
        controllers: [routeStubs(stubbed)],
        notYetPorted: NOT_YET_PORTED_ROUTES.filter((route) => !stubbed.includes(route)),
    };
};

const SAMPLE_PARAMS: Record<string, string> = { kind: 'npcs', owner: 'passages', mapId: 'global' };

export const samplePath = (route: TRouteName, storyId: string) =>
    routeTemplate(route).replace(/:([A-Za-z]+)/g, (_match, name: string) =>
        name === STORY_ID_PARAM ? encodeURIComponent(storyId) : (SAMPLE_PARAMS[name] ?? 'x')
    );
