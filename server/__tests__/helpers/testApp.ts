import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { TRouteName } from '@story/protocol';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/AppModule';
import { AUTH_OPTIONS, GRANT_TTL_MS, type TAuthOptions } from '../../src/auth/authOptions';
import { DEFAULT_ALLOWED_ORIGINS } from '../../src/auth/csrf';
import { configureExpressApp, EXPRESS_APP_OPTIONS } from '../../src/common/expressApp';
import { NOT_YET_PORTED_ROUTES } from '../../src/common/notYetPortedRoutes';
import { NOT_YET_PORTED } from '../../src/common/ProtocolRouteCheck';
import { EXAMPLE_STORY_ROOT } from '../../src/project/ProjectRoot';
import { parseStoryFile, STORY_FILE, type TStoryFile } from '../../src/stories/storyFile';
import { STORIES_ROOT } from '../../src/stories/storiesRoot';
import { StoryRepository } from '../../src/stories/StoryRepository';
import { truncateTables } from './database';
import { makeTempStoriesRoot } from './storiesRoot';

export type TTestAppOptions = {
    controllers?: Type[];
    notYetPorted?: readonly TRouteName[];
    auth?: Partial<TAuthOptions>;
    truncate?: boolean;
    storiesRoot?: string;
};

export type TTestApp = { app: INestApplication; base: string; storiesRoot: string; close: () => Promise<void> };

const TEST_AUTH_OPTIONS: TAuthOptions = {
    grantTtlMs: GRANT_TTL_MS,
    cookieSecure: false,
    trustProxy: false,
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
};

// a fresh app on the shared `story_test` database; `truncate: false` keeps the rows of an earlier app.
// Without `storiesRoot` the app gets an empty temp root, removed on close.
export const createTestApp = async ({
    controllers = [],
    notYetPorted = NOT_YET_PORTED_ROUTES,
    auth = {},
    truncate = true,
    storiesRoot,
}: TTestAppOptions = {}): Promise<TTestApp> => {
    const { root, cleanup } =
        storiesRoot === undefined
            ? await makeTempStoriesRoot()
            : { root: storiesRoot, cleanup: () => Promise.resolve() };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers })
        .overrideProvider(NOT_YET_PORTED)
        .useValue(notYetPorted)
        .overrideProvider(AUTH_OPTIONS)
        .useValue({ ...TEST_AUTH_OPTIONS, ...auth })
        .overrideProvider(STORIES_ROOT)
        .useValue(root)
        .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ ...EXPRESS_APP_OPTIONS, logger: false });
    configureExpressApp(app);
    await app.init();
    if (truncate) await truncateTables(app.get(DataSource));
    await app.listen(0, '127.0.0.1');
    const close = async () => {
        await app.close();
        await cleanup();
    };
    return { app, base: await app.getUrl(), storiesRoot: root, close };
};

export const readExampleStoryFile = async (): Promise<TStoryFile> =>
    parseStoryFile(JSON.parse(await readFile(path.join(EXAMPLE_STORY_ROOT, STORY_FILE), 'utf8')));

// the example's password hash, so EXAMPLE_PASSWORD logs in
export const seedStory = async (app: INestApplication, id: string, overrides: Partial<TStoryFile> = {}) => {
    const file = { ...(await readExampleStoryFile()), ...overrides };
    await app.get(StoryRepository).insert(id, file);
    return file;
};
