import { Controller, Module, Req } from '@nestjs/common';
import { routeDef, routeTemplate, STORY_ID_PARAM, STORY_ROUTE_NAMES, type TStoryRouteName } from '@story/protocol';
import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRANT_TTL_MS } from '../src/auth/authOptions';
import { storyGrantOf } from '../src/auth/storyGrant';
import { ProtocolRoute } from '../src/common/ProtocolRoute';
import { ProjectInfoModule } from '../src/editor/projectInfo/ProjectInfoModule';
import { login, requestJson, type TAny } from './helpers/http';
import { createTestApp, type TModuleOverride, type TTestApp } from './helpers/testApp';

let app: TTestApp | undefined;

const start = async (overrideModules: readonly TModuleOverride[] = []) => {
    app = await createTestApp({
        overrideModules,
        stories: [
            { id: 'open', public: true },
            { id: 'closed', public: false },
        ],
    });
    return app.base;
};

afterEach(async () => {
    vi.useRealTimers();
    await app?.close();
    app = undefined;
});

const SAMPLE_PARAMS: Record<string, string> = { kind: 'npcs', owner: 'passages', mapId: 'global' };

const samplePath = (route: TStoryRouteName, storyId: string) =>
    routeTemplate(route).replace(/:([A-Za-z]+)/g, (_match, name: string) =>
        name === STORY_ID_PARAM ? encodeURIComponent(storyId) : (SAMPLE_PARAMS[name] ?? 'x')
    );

type TRouteAnswer = { status: number; body: TAny };

// the change feed never ends and the export / image file are not JSON: only the status matters then
const callRoute = async (base: string, route: TStoryRouteName, storyId: string, cookie?: string) => {
    const { method } = routeDef(route);
    const abort = new AbortController();
    const res = await fetch(base + samplePath(route, storyId), {
        method,
        signal: abort.signal,
        headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie } : {}) },
        body: method === 'GET' ? undefined : JSON.stringify({ version: '1' }),
    });
    const isJson = res.headers.get('content-type')?.startsWith('application/json') ?? false;
    if (!isJson) {
        abort.abort();
        return { status: res.status, body: undefined } satisfies TRouteAnswer;
    }
    return { status: res.status, body: JSON.parse(await res.text()) } satisfies TRouteAnswer;
};

type TOutcome = 'passed' | 'unauthorized' | 'no story';

// past the guard, the handler answers whatever the sample params give (200, 400, 404 No chapter, 409 …)
const outcomeOf = ({ status, body }: TRouteAnswer): TOutcome | string => {
    if (status === 401) return 'unauthorized';
    if (status === 404 && /^No story /.test(body?.message ?? '')) return 'no story';
    return status < 500 ? 'passed' : `${status} ${JSON.stringify(body)}`;
};

const outcomes = async (base: string, storyId: string, cookie?: string) => {
    const result: Record<string, TOutcome | string> = {};
    for (const route of STORY_ROUTE_NAMES) result[route] = outcomeOf(await callRoute(base, route, storyId, cookie));
    return result;
};

const expected = (outcome: (access: 'read' | 'write') => TOutcome) =>
    Object.fromEntries(
        STORY_ROUTE_NAMES.map((route) => {
            const { access } = routeDef(route);
            if (access === 'public') throw new Error(`story route ${route} is public`);
            return [route, outcome(access)];
        })
    );

const READS_ONLY = expected((access) => (access === 'read' ? 'passed' : 'unauthorized'));

@Controller()
class GrantProbe {
    @ProtocolRoute('getProject')
    getProject(@Req() req: Request) {
        return { grant: storyGrantOf(req) ?? null };
    }
}

@Module({ controllers: [GrantProbe] })
class GrantProbeModule {}

describe('story access matrix (D3), against the real handlers', () => {
    it('covers both reads and writes', () => {
        const levels = new Set(STORY_ROUTE_NAMES.map((route) => routeDef(route).access));
        expect([...levels].sort()).toEqual(['read', 'write']);
    });

    it('private story: everything needs a grant for this very story', async () => {
        const base = await start();
        const elsewhere = await login(base, 'open');
        for (const cookie of [undefined, 'story_session=forged', elsewhere]) {
            expect(await outcomes(base, 'closed', cookie)).toEqual(expected(() => 'unauthorized'));
        }
        const cookie = await login(base, 'closed');
        expect(await outcomes(base, 'closed', cookie)).toEqual(expected(() => 'passed'));
    }, 120_000);

    it('public story: every read without a login, writes need a grant', async () => {
        const base = await start();
        expect(await outcomes(base, 'open')).toEqual(READS_ONLY);
        const elsewhere = await login(base, 'closed');
        expect(await outcomes(base, 'open', elsewhere)).toEqual(READS_ONLY);
        const cookie = await login(base, 'open');
        expect(await outcomes(base, 'open', cookie)).toEqual(expected(() => 'passed'));
    }, 120_000);

    it('unknown story: 404 on every route, logged in or not', async () => {
        const base = await start();
        const cookie = await login(base, 'closed');
        for (const who of [undefined, cookie]) {
            expect(await outcomes(base, 'nope', who)).toEqual(expected(() => 'no story'));
        }
        const res = await callRoute(base, 'getStoryInfo', 'nope');
        expect(res.body).toEqual({ error: 'not_found', message: 'No story "nope"' });
        expect(app?.contexts.loadedIds()).toEqual([]);
    }, 120_000);

    it('an expired grant counts as none', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const base = await start();
        const closed = await login(base, 'closed');
        const open = await login(base, 'open', { cookie: closed });
        expect(await outcomes(base, 'closed', closed)).toEqual(expected(() => 'passed'));
        expect(await outcomes(base, 'open', open)).toEqual(expected(() => 'passed'));
        vi.setSystemTime(Date.now() + GRANT_TTL_MS + 1000);
        expect(await outcomes(base, 'closed', closed)).toEqual(expected(() => 'unauthorized'));
        expect(await outcomes(base, 'open', open)).toEqual(READS_ONLY);
    }, 120_000);

    it('exports a public story without a login', async () => {
        const base = await start();
        const res = await fetch(`${base}/api/stories/open/export`);
        expect([res.status, res.headers.get('content-type')]).toEqual([200, 'application/zip']);
        expect((await fetch(`${base}/api/stories/closed/export`)).status).toBe(401);
    });

    it('hands the grant expiry to the handler', async () => {
        const base = await start([{ replace: ProjectInfoModule, with: GrantProbeModule }]);
        const before = Date.now();
        const cookie = await login(base, 'closed');
        const res = await requestJson(`${base}/api/stories/closed/project`, 'GET', { headers: { cookie } });
        expect(res.body.grant.expiresAt).toBeGreaterThanOrEqual(before + GRANT_TTL_MS);
        expect(res.body.grant.expiresAt).toBeLessThanOrEqual(Date.now() + GRANT_TTL_MS);
        const open = await requestJson(`${base}/api/stories/open/project`, 'GET');
        expect(open.body).toEqual({ grant: null });
    });

    it('locks a story with an unauthorized error body', async () => {
        const base = await start();
        const res = await callRoute(base, 'updateStoryInfo', 'closed');
        expect([res.status, res.body]).toEqual([
            401,
            { error: 'unauthorized', message: 'Story "closed" is locked: log in with its password first' },
        ]);
    });
});
