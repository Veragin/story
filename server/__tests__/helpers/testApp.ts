import { stat } from 'node:fs/promises';
import type { Server } from 'node:http';
import path from 'node:path';
import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/AppModule';
import { AUTH_OPTIONS, GRANT_TTL_MS, type TAuthOptions } from '../../src/auth/authOptions';
import { DEFAULT_ALLOWED_ORIGINS } from '../../src/auth/csrf';
import { SessionService } from '../../src/auth/SessionService';
import { configureExpressApp, EXPRESS_APP_OPTIONS } from '../../src/common/expressApp';
import { EXAMPLE_STORY_ROOT, ProjectRoot } from '../../src/project/ProjectRoot';
import type { TStoryFile } from '../../src/stories/storyFile';
import { readStorySeed } from '../../src/stories/storySeed';
import { STORIES_ROOT } from '../../src/stories/storiesRoot';
import { StoryRepository } from '../../src/database/repositories/StoryRepository';
import type { TServerContext } from '../../src/storyContext/serverContext';
import { StoryContexts } from '../../src/storyContext/StoryContexts';
import {
    DEFAULT_STORY_CONTEXTS_OPTIONS,
    STORY_CONTEXTS_OPTIONS,
    type TStoryContextsOptions,
} from '../../src/storyContext/storyContextsOptions';
import { truncateTables } from './database';
import { copyExampleStory, makeTempStoriesRoot } from './storiesRoot';

export type TTestStory = string | ({ id: string } & Partial<TStoryFile>);

export type TModuleOverride = { replace: Type; with: Type };

export type TTestAppOptions = {
    controllers?: Type[];
    overrideModules?: readonly TModuleOverride[];
    auth?: Partial<TAuthOptions>;
    truncate?: boolean;
    storiesRoot?: string;
    stories?: readonly TTestStory[];
    watch?: boolean;
    batchMs?: number;
    idleMs?: number;
    sweepMs?: number;
};

export type TTestApp = {
    app: INestApplication;
    server: Server;
    base: string;
    storiesRoot: string;
    contexts: StoryContexts;
    stories: StoryRepository;
    sessions: SessionService;
    project: (storyId: string) => ProjectRoot;
    story: (storyId: string) => Promise<TServerContext>;
    listen: () => Promise<number>;
    close: () => Promise<void>;
};

const TEST_AUTH_OPTIONS: TAuthOptions = {
    grantTtlMs: GRANT_TTL_MS,
    cookieSecure: false,
    trustProxy: false,
    allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
};

const exists = async (file: string) => (await stat(file).catch(() => null)) !== null;

const storyOf = (story: TTestStory): { id: string; overrides: Partial<TStoryFile> } => {
    if (typeof story === 'string') return { id: story, overrides: {} };
    const { id, ...overrides } = story;
    return { id, overrides };
};

// A fresh app on the shared `story_test` database; `truncate: false` keeps the rows of an earlier app.
// Without `storiesRoot` the app gets an empty temp root, removed on close. Each of `stories` gets a
// copy of the example (unless its folder exists) and a row with the example's metadata (password `example`).
// The story contexts do not watch the files unless `watch: true`.
export const createTestApp = async ({
    controllers = [],
    overrideModules = [],
    auth = {},
    truncate = true,
    storiesRoot,
    stories = [],
    watch = false,
    batchMs,
    idleMs = DEFAULT_STORY_CONTEXTS_OPTIONS.idleMs,
    sweepMs,
}: TTestAppOptions = {}): Promise<TTestApp> => {
    const { root, cleanup } =
        storiesRoot === undefined
            ? await makeTempStoriesRoot()
            : { root: storiesRoot, cleanup: () => Promise.resolve() };
    const contextsOptions: TStoryContextsOptions = { watch, batchMs, idleMs, sweepMs };
    const builder = Test.createTestingModule({ imports: [AppModule], controllers });
    for (const override of overrideModules) builder.overrideModule(override.replace).useModule(override.with);
    const moduleRef = await builder
        .overrideProvider(AUTH_OPTIONS)
        .useValue({ ...TEST_AUTH_OPTIONS, ...auth })
        .overrideProvider(STORIES_ROOT)
        .useValue(root)
        .overrideProvider(STORY_CONTEXTS_OPTIONS)
        .useValue(contextsOptions)
        .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ ...EXPRESS_APP_OPTIONS, logger: false });
    configureExpressApp(app);
    await app.init();
    if (truncate) await truncateTables(app.get(DataSource));
    for (const { id, overrides } of stories.map(storyOf)) {
        if (!(await exists(path.join(root, id)))) await copyExampleStory(root, id);
        await seedStory(app, id, overrides);
    }
    await app.listen(0, '127.0.0.1');
    const server: Server = app.getHttpServer();
    const contexts = app.get(StoryContexts);
    let closing: Promise<void> | undefined;
    const shutdown = async () => {
        await app.close();
        await cleanup();
    };
    const close = () => (closing ??= shutdown());
    return {
        app,
        server,
        base: await app.getUrl(),
        storiesRoot: root,
        contexts,
        stories: app.get(StoryRepository),
        sessions: app.get(SessionService),
        project: (storyId) => new ProjectRoot(path.join(root, storyId), storyId),
        story: (storyId) => contexts.get(storyId),
        listen: () => Promise.resolve(portOf(server)),
        close,
    };
};

const portOf = (server: Server): number => {
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('The test app is not listening on a port');
    return address.port;
};

// the old suites' `base = await listenLocal(app)`: a test app already listens on 127.0.0.1
export const listenLocal = (app: TTestApp): Promise<string> => Promise.resolve(app.base);

export const readExampleStoryFile = async (): Promise<TStoryFile> => (await readStorySeed(EXAMPLE_STORY_ROOT)).file;

// the example's password hash, so EXAMPLE_PASSWORD logs in
export const seedStory = async (app: INestApplication, id: string, overrides: Partial<TStoryFile> = {}) => {
    const file = { ...(await readExampleStoryFile()), ...overrides };
    await app.get(StoryRepository).insert(id, file);
    return file;
};
