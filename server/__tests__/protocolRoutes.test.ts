import { Body, Controller, type INestApplication, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildGlobalPath, buildPath, ROUTE_NAMES, type TRouteName } from '@story/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProtocolRoute, ProtocolRouteName } from '../src/common/ProtocolRoute';
import { ProtocolRoutesModule } from '../src/common/ProtocolRoutesModule';
import { RouteParams, type THandlerParams } from '../src/common/RouteParams';

const otherThan = (...excluded: TRouteName[]) => ROUTE_NAMES.filter((route) => !excluded.includes(route));

// one controller with a real @ProtocolRoute handler per given route
const routeStubs = (routes: readonly TRouteName[]): Type => {
    @Controller()
    class RouteStubs {}
    const prototype: object = RouteStubs.prototype;
    for (const route of routes) {
        Object.defineProperty(prototype, route, { value: () => ({ route }), writable: true, configurable: true });
        const descriptor = Object.getOwnPropertyDescriptor(prototype, route);
        if (descriptor) ProtocolRoute(route)(prototype, route, descriptor);
    }
    return RouteStubs;
};

const boot = async (controllers: Type[]) => {
    const moduleRef = await Test.createTestingModule({ imports: [ProtocolRoutesModule], controllers }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    try {
        await app.init();
    } finally {
        await app.close();
    }
};

@Controller()
class HealthOnly {
    @ProtocolRoute('health')
    health() {
        return { ok: true };
    }
}

@Controller()
class SecondHealth {
    @ProtocolRoute('health')
    again() {
        return { ok: true };
    }
}

@Controller()
class UnknownRoute {
    bogus() {
        return null;
    }
}
Reflect.defineMetadata(ProtocolRouteName.KEY, 'bogus', UnknownRoute.prototype.bogus);

describe('protocol route completeness check', () => {
    it('boots when every route has exactly one handler', async () => {
        await expect(boot([HealthOnly, routeStubs(otherThan('health'))])).resolves.toBeUndefined();
    });

    it('fails boot when a route has no handler', async () => {
        await expect(boot([HealthOnly, routeStubs(otherThan('health', 'getChapter', 'login'))])).rejects.toThrow(
            'Protocol routes without a handler: getChapter, login'
        );
    });

    it('fails boot when a route has two handlers', async () => {
        await expect(boot([HealthOnly, SecondHealth, routeStubs(otherThan('health'))])).rejects.toThrow(
            'Protocol route health has 2 handlers (HealthOnly.health, SecondHealth.again)'
        );
    });

    it('fails boot on a handler for an unknown route name', async () => {
        await expect(boot([HealthOnly, UnknownRoute, routeStubs(otherThan('health'))])).rejects.toThrow(
            'Unknown protocol route "bogus" (UnknownRoute.bogus)'
        );
    });
});

@Controller()
class Probe {
    @ProtocolRoute('getEntity')
    getEntity(@RouteParams() params: THandlerParams<'getEntity'>) {
        return params;
    }

    @ProtocolRoute('getSource')
    getSource(@RouteParams() params: THandlerParams<'getSource'>) {
        return params;
    }

    @ProtocolRoute('createChapter')
    createChapter(@Body() body: unknown) {
        return body;
    }

    @ProtocolRoute('addLiteralValue')
    addLiteralValue() {
        return { ok: true };
    }

    @ProtocolRoute('login')
    login(@RouteParams() params: THandlerParams<'login'>) {
        return params;
    }

    @ProtocolRoute('deleteChapter')
    deleteChapter(@RouteParams() params: THandlerParams<'deleteChapter'>) {
        return params;
    }
}

describe('@ProtocolRoute', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ controllers: [Probe] }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        await app.listen(0, '127.0.0.1');
        baseUrl = await app.getUrl();
    });

    afterAll(async () => {
        await app.close();
    });

    const send = (method: string, path: string) =>
        fetch(baseUrl + path, {
            method,
            headers: { 'content-type': 'application/json' },
            body: method === 'GET' ? undefined : '{}',
        });

    it('mounts a story route below /api/stories/:storyId and hands over decoded, checked params', async () => {
        const response = await send('GET', buildPath('my story', 'getEntity', { kind: 'characters', id: 'a/b' }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ storyId: 'my story', kind: 'characters', id: 'a/b' });
    });

    it('answers 404 for a param outside its TRouteParams type', async () => {
        const entity = await send('GET', '/api/stories/s/entities/dragons/x');
        expect(entity.status).toBe(404);
        expect(await entity.json()).toMatchObject({ message: 'No entity kind "dragons"' });
        const source = await send('GET', '/api/stories/s/source/nobody/x');
        expect(source.status).toBe(404);
        expect(await source.json()).toMatchObject({ message: 'No source owner "nobody"' });
    });

    it('uses the protocol method: a GET-only path does not answer a PUT', async () => {
        expect((await send('PUT', buildPath('s', 'getEntity', { kind: 'characters', id: 'x' }))).status).toBe(404);
        expect((await send('DELETE', buildPath('s', 'deleteChapter', { chapterId: 'c' }))).status).toBe(200);
    });

    it('answers 201 for CREATED_ROUTES, 204 for NO_CONTENT_ROUTES and 200 for any other POST', async () => {
        expect((await send('POST', buildPath('s', 'createChapter', {}))).status).toBe(201);
        expect((await send('POST', buildPath('s', 'addLiteralValue', { name: 'TMood' }))).status).toBe(200);
        const login = await send('POST', buildGlobalPath('login', { storyId: 's' }));
        expect(login.status).toBe(204);
    });
});
