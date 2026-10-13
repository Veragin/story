import { routeDef, STORY_ROUTE_NAMES, type TStoryRouteName } from '@story/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { login, requestJson, sleep, type TJsonResponse } from './helpers/http';
import { samplePath, stubbedApp } from './helpers/routeStubs';
import { createTestApp, seedStory, type TTestApp } from './helpers/testApp';

const { stubbed, controllers, notYetPorted } = stubbedApp(STORY_ROUTE_NAMES);
const STORY_ROUTES_UNDER_TEST = STORY_ROUTE_NAMES.filter((route) => stubbed.includes(route));

let app: TTestApp | undefined;

const start = async (grantTtlMs?: number) => {
    app = await createTestApp({ controllers, notYetPorted, auth: grantTtlMs === undefined ? {} : { grantTtlMs } });
    await seedStory(app.app, 'open', { public: true });
    await seedStory(app.app, 'closed', { public: false });
    return app.base;
};

afterEach(async () => {
    await app?.close();
    app = undefined;
});

const callRoute = (base: string, route: TStoryRouteName, storyId: string, cookie?: string) => {
    const { method } = routeDef(route);
    return requestJson(base + samplePath(route, storyId), method, {
        body: method === 'GET' ? undefined : { version: '1' },
        headers: cookie ? { cookie } : {},
    });
};

type TOutcome = 'granted' | 'public' | 'unauthorized' | 'no story';

const outcomeOf = (res: TJsonResponse): TOutcome | string => {
    if (res.status === 401 && res.body.error === 'unauthorized') return 'unauthorized';
    if (res.status === 404 && /^No story /.test(res.body.message)) return 'no story';
    if (res.status < 300 && res.body?.grant) return 'granted';
    if (res.status < 300 && res.body?.grant === null) return 'public';
    return `${res.status} ${JSON.stringify(res.body)}`;
};

const outcomes = async (base: string, storyId: string, cookie?: string) => {
    const result: Record<string, TOutcome | string> = {};
    for (const route of STORY_ROUTES_UNDER_TEST)
        result[route] = outcomeOf(await callRoute(base, route, storyId, cookie));
    return result;
};

const expected = (outcome: (access: 'read' | 'write') => TOutcome) =>
    Object.fromEntries(
        STORY_ROUTES_UNDER_TEST.map((route) => {
            const { access } = routeDef(route);
            if (access === 'public') throw new Error(`story route ${route} is public`);
            return [route, outcome(access)];
        })
    );

describe('story access matrix (D3)', () => {
    it('covers story routes', () => {
        expect(STORY_ROUTES_UNDER_TEST.length).toBeGreaterThan(0);
    });

    it('private story: everything needs a grant for this very story', async () => {
        const base = await start();
        const elsewhere = await login(base, 'open');
        for (const cookie of [undefined, 'story_session=forged', elsewhere]) {
            expect(await outcomes(base, 'closed', cookie)).toEqual(expected(() => 'unauthorized'));
        }
        const cookie = await login(base, 'closed');
        expect(await outcomes(base, 'closed', cookie)).toEqual(expected(() => 'granted'));
    }, 60_000);

    it('public story: every read without a login, writes need a grant', async () => {
        const base = await start();
        expect(await outcomes(base, 'open')).toEqual(
            expected((access) => (access === 'read' ? 'public' : 'unauthorized'))
        );
        const elsewhere = await login(base, 'closed');
        expect(await outcomes(base, 'open', elsewhere)).toEqual(
            expected((access) => (access === 'read' ? 'public' : 'unauthorized'))
        );
        const cookie = await login(base, 'open');
        expect(await outcomes(base, 'open', cookie)).toEqual(expected(() => 'granted'));
    }, 60_000);

    it('unknown story: 404 on every route, logged in or not', async () => {
        const base = await start();
        const cookie = await login(base, 'closed');
        for (const who of [undefined, cookie]) {
            expect(await outcomes(base, 'nope', who)).toEqual(expected(() => 'no story'));
        }
        const res = await callRoute(base, 'getStoryInfo', 'nope');
        expect(res.body).toEqual({ error: 'not_found', message: 'No story "nope"' });
    }, 60_000);

    it('an expired grant counts as none', async () => {
        const base = await start(1000);
        const closed = await login(base, 'closed');
        const open = await login(base, 'open', { cookie: closed });
        expect(outcomeOf(await callRoute(base, 'updateTimelineLayout', 'closed', closed))).toBe('granted');
        expect(outcomeOf(await callRoute(base, 'updateTimelineLayout', 'open', open))).toBe('granted');
        await sleep(1100);
        expect(await outcomes(base, 'closed', closed)).toEqual(expected(() => 'unauthorized'));
        expect(await outcomes(base, 'open', open)).toEqual(
            expected((access) => (access === 'read' ? 'public' : 'unauthorized'))
        );
    }, 60_000);

    it('hands the grant expiry to the handler', async () => {
        const base = await start();
        const before = Date.now();
        const cookie = await login(base, 'closed');
        const res = await callRoute(base, 'getProject', 'closed', cookie);
        expect(res.body.grant.expiresAt).toBeGreaterThanOrEqual(before + 24 * 60 * 60_000);
        expect(res.body.grant.expiresAt).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60_000);
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
