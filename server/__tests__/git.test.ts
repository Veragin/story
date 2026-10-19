import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GLOBAL_MAP_ID, STORY_ROUTE_NAMES, routeDef, routeTemplate, storyImportForm } from '@story/protocol';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { DataSource } from 'typeorm';
import { exists } from '../src/common/fileStat';
import { createDefaultMap, encodeMapFile, MAP_FILE } from '../src/json/mapFile';
import { storyTsconfig } from '../src/stories/storyTsconfig';
import { afterEach, describe, expect, it } from 'vitest';
import { cloneRepo, commitAndPush, git, makeBareRepo, TEST_GIT_OPTIONS, type TBareRepo } from './helpers/git';
import { login, requestJson, waitFor } from './helpers/http';
import { openEventStream } from './helpers/sse';
import { createTestApp, type TTestApp } from './helpers/testApp';

const TOKEN = 'secret-token-0123456789';

let app: TTestApp | undefined;
let repo: TBareRepo | undefined;

afterEach(async () => {
    await app?.close();
    await repo?.cleanup();
    app = undefined;
    repo = undefined;
});

const start = async ({ git: gitOptions = TEST_GIT_OPTIONS, watch = false } = {}) => {
    app = await createTestApp({
        stories: ['alpha', 'example'],
        git: gitOptions,
        watch,
        batchMs: watch ? 20 : undefined,
    });
    repo = await makeBareRepo();
    const cookie = await login(app.base, 'alpha');
    const storyBase = `${app.base}/api/stories/alpha`;
    const call = (method: string, sub = '', body?: unknown) =>
        requestJson(`${storyBase}/git${sub}`, method, { body, headers: { cookie } });
    const story = (sub: string) => requestJson(`${storyBase}${sub}`, 'GET', { headers: { cookie } });
    const events = () => openEventStream(`${storyBase}/events`, { cookie });
    return { testApp: app, repo, cookie, call, story, events, dir: path.join(app.storiesRoot, 'alpha') };
};

type TStart = Awaited<ReturnType<typeof start>>;

const chapterName = async (story: TStart['story'], chapterId: string) => {
    const project = await story('/project');
    return project.body.chapters.find((c: { id: string }) => c.id === chapterId)?.name;
};

const VILLAGE_CHAPTER = path.join('data', 'chapters', 'village', 'village.chapter.ts');

const renameVillage = async (dir: string, title: string) => {
    const file = path.join(dir, VILLAGE_CHAPTER);
    await writeFile(file, (await readFile(file, 'utf8')).replace(/title: '[^']*'/, `title: '${title}'`));
};

const pushedClone = async (repo: TBareRepo, change: (clone: string) => Promise<void>, branch = 'main') => {
    const clone = await cloneRepo(repo, `clone-${branch}-${Date.now()}`);
    if (branch !== 'main') await git(clone, 'switch', '-q', '-c', branch);
    await change(clone);
    await commitAndPush(clone, `Change on ${branch}`, branch);
    return clone;
};

const settleBriefly = () => new Promise((resolve) => setTimeout(resolve, 300));

const setupPush = (call: TStart['call'], url: string) =>
    call('POST', '/setup', { remoteUrl: url, branch: 'main', token: TOKEN, initial: 'push' });

describe('git routes', () => {
    it('without a key: getGit says unavailable, the rest answer 503', async () => {
        const { testApp, call } = await start({ git: {} });
        expect((await call('GET')).body).toEqual({ available: false, config: null, status: null });
        const res = await call('POST', '/fetch');
        expect([res.status, res.body.error]).toEqual([503, 'git_unavailable']);
        expect((await call('POST', '/setup', {})).status).toBe(503);
        expect((await call('GET', '/log')).status).toBe(503);
        const health = await requestJson(`${testApp.base}/api/health`, 'GET');
        expect(health.body.git).toBe('unavailable');
    });

    it('a configured app reports git up and answers unconfigured routes with git_not_configured', async () => {
        const { testApp, call } = await start();
        expect((await call('GET')).body).toEqual({ available: true, config: null, status: null });
        const health = await requestJson(`${testApp.base}/api/health`, 'GET');
        expect(health.body.git).toBe('up');
        for (const [method, sub] of [
            ['POST', '/fetch'],
            ['POST', '/push'],
            ['POST', '/pull'],
            ['GET', '/log'],
        ] as const) {
            const res = await call(method, sub);
            expect([res.status, res.body.error]).toEqual([409, 'git_not_configured']);
        }
    });

    it('setup push uploads the story, and no response carries the token', async () => {
        const { testApp, call, repo, dir } = await start();
        const res = await setupPush(call, repo.url);
        expect(res.status).toBe(201);
        expect(res.body.config).toEqual({
            remoteUrl: repo.url,
            branch: 'main',
            hasToken: true,
            authorName: expect.any(String),
            authorEmail: 'alpha@story.local',
            version: '1',
        });
        expect(res.body.status).toMatchObject({
            branch: 'main',
            detached: false,
            ahead: 0,
            behind: 0,
            upstream: 'origin/main',
            changes: [],
            localBranches: ['main'],
            remoteBranches: ['main'],
        });
        expect(JSON.stringify(res.body)).not.toContain(TOKEN);
        expect(JSON.stringify((await call('GET')).body)).not.toContain(TOKEN);

        const [row] = await testApp.app.get(DataSource).query('SELECT tokenEncrypted FROM story_git');
        expect(row.tokenEncrypted).toMatch(/^v1\$/);
        expect(row.tokenEncrypted).not.toContain(TOKEN);
        expect(await readFile(path.join(dir, '.git', 'config'), 'utf8')).not.toContain(TOKEN);

        const clone = await cloneRepo(repo, 'clone');
        expect(await readFile(path.join(clone, 'data', 'register.ts'), 'utf8')).toBe(
            await readFile(path.join(dir, 'data', 'register.ts'), 'utf8')
        );
        expect(await readFile(path.join(clone, '.gitignore'), 'utf8')).toContain('node_modules/');
        expect((await git(clone, 'log', '--format=%s')).trim()).toBe('Initial story');

        const again = await setupPush(call, repo.url);
        expect([again.status, again.body.error]).toEqual([409, 'exists']);
    });

    it('commit + push reaches a second clone; log lists it; a clean tree has nothing to commit', async () => {
        const { call, repo, dir } = await start();
        await setupPush(call, repo.url);
        const empty = await call('POST', '/commit', { message: 'Nothing', push: true });
        expect([empty.status, empty.body.error]).toEqual([409, 'git_nothing_to_commit']);

        await writeFile(path.join(dir, 'data', 'note.txt'), 'hello\n');
        const status = await call('GET');
        expect(status.body.status.changes).toEqual([{ path: 'data/note.txt', kind: 'added' }]);
        const res = await call('POST', '/commit', { message: 'Add a note', push: true });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ pushed: true, status: { changes: [], ahead: 0 } });
        expect(res.body.commit).toMatch(/^[0-9a-f]{40}$/);

        const clone = await cloneRepo(repo, 'clone');
        expect(await readFile(path.join(clone, 'data', 'note.txt'), 'utf8')).toBe('hello\n');

        const log = await call('GET', '/log?limit=1');
        expect(log.body).toEqual([
            expect.objectContaining({ hash: res.body.commit, subject: 'Add a note', files: ['data/note.txt'] }),
        ]);
        const older = await call('GET', `/log?before=${res.body.commit}`);
        expect(older.body.map((e: { subject: string }) => e.subject)).toEqual(['Initial story']);
    });

    it('a rejected push keeps the commit; pull merges the remote, then push succeeds', async () => {
        const { call, repo, dir } = await start();
        await setupPush(call, repo.url);
        const clone = await cloneRepo(repo, 'clone');
        await writeFile(path.join(clone, 'data', 'remote.txt'), 'remote\n');
        await commitAndPush(clone, 'Remote change');

        await writeFile(path.join(dir, 'data', 'local.txt'), 'local\n');
        const pull = await call('POST', '/pull');
        expect([pull.status, pull.body.error]).toEqual([409, 'git_dirty']);
        const commit = await call('POST', '/commit', { message: 'Local change', push: true });
        expect(commit.body).toMatchObject({ pushed: false, pushError: { error: 'git_rejected' } });

        const merged = await call('POST', '/pull');
        expect(merged.status).toBe(200);
        expect(merged.body.updated).toBe(true);
        expect(await readFile(path.join(dir, 'data', 'remote.txt'), 'utf8')).toBe('remote\n');
        const pushed = await call('POST', '/push');
        expect(pushed.body).toMatchObject({ ahead: 0, behind: 0 });
    });

    it('a conflicting pull is aborted and lists the files', async () => {
        const { call, repo, dir } = await start();
        await setupPush(call, repo.url);
        const clone = await cloneRepo(repo, 'clone');
        await writeFile(path.join(clone, 'data', 'register.ts'), '// remote\n');
        await commitAndPush(clone, 'Remote edit');
        await writeFile(path.join(dir, 'data', 'register.ts'), '// local\n');
        await call('POST', '/commit', { message: 'Local edit', push: false });

        const res = await call('POST', '/pull');
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ error: 'git_conflict', files: ['data/register.ts'] });
        expect((await call('GET')).body.status).toMatchObject({ changes: [], ahead: 1, behind: 1 });
        expect(await exists(path.join(dir, '.git', 'MERGE_HEAD'))).toBe(false);
        expect(await readFile(path.join(dir, 'data', 'register.ts'), 'utf8')).toBe('// local\n');
    });

    it('checks out a new, a local and a remote branch, and the project follows each', async () => {
        const { call, story, repo, dir } = await start();
        await setupPush(call, repo.url);
        await pushedClone(repo, (clone) => renameVillage(clone, 'Feature Village'), 'feature');
        expect(await chapterName(story, 'village')).toBe('Village Chapter');

        const created = await call('POST', '/checkout', { branch: 'draft', create: true });
        expect(created.body).toMatchObject({ branch: 'draft', upstream: null });
        await renameVillage(dir, 'Draft Village');
        await call('POST', '/commit', { message: 'Draft', push: false });
        expect(await chapterName(story, 'village')).toBe('Draft Village');

        expect((await call('POST', '/checkout', { branch: 'main', create: false })).body.branch).toBe('main');
        expect(await chapterName(story, 'village')).toBe('Village Chapter');
        await call('POST', '/fetch');
        const remote = await call('POST', '/checkout', { branch: 'feature', create: false });
        expect(remote.body).toMatchObject({ branch: 'feature', upstream: 'origin/feature' });
        expect(await chapterName(story, 'village')).toBe('Feature Village');
        await call('POST', '/checkout', { branch: 'draft', create: false });
        expect(await chapterName(story, 'village')).toBe('Draft Village');

        const missing = await call('POST', '/checkout', { branch: 'nope', create: false });
        expect(missing.status).toBe(404);
        const taken = await call('POST', '/checkout', { branch: 'main', create: true });
        expect([taken.status, taken.body.error]).toEqual([409, 'exists']);
        const bad = await call('POST', '/checkout', { branch: 'bad..name', create: true });
        expect(bad.status).toBe(400);
        await writeFile(path.join(dir, 'data', 'dirty.txt'), 'dirty\n');
        const dirty = await call('POST', '/checkout', { branch: 'main', create: false });
        expect([dirty.status, dirty.body.error]).toEqual([409, 'git_dirty']);
    });

    it('pull fast-forwards and merges, and the project and the map size follow', async () => {
        const { call, story, repo, dir } = await start();
        await setupPush(call, repo.url);
        expect(await chapterName(story, 'village')).toBe('Village Chapter');
        const before = (await story('/info')).body;

        await pushedClone(repo, async (clone) => {
            await renameVillage(clone, 'Pulled Village');
            const map = await encodeMapFile(createDefaultMap(GLOBAL_MAP_ID, { width: 33, height: 21 }));
            await writeFile(path.join(clone, ...MAP_FILE.split('/')), map);
        });
        const forward = await call('POST', '/pull');
        expect(forward.body).toMatchObject({ updated: true, status: { ahead: 0, behind: 0, changes: [] } });
        expect(forward.body.to).toBe((await git(dir, 'rev-parse', 'origin/main')).trim());
        expect((await git(dir, 'log', '--format=%p', '-n1')).trim().split(' ')).toHaveLength(1);
        expect(await chapterName(story, 'village')).toBe('Pulled Village');
        const info = (await story('/info')).body;
        expect(info.mapSize).toEqual({ width: 33, height: 21 });
        expect(info.version).not.toBe(before.version);

        const same = await call('POST', '/pull');
        expect(same.body).toMatchObject({ updated: false });
        expect(same.body.from).toBe(same.body.to);

        await pushedClone(repo, (clone) => renameVillage(clone, 'Merged Village'));
        await writeFile(path.join(dir, 'data', 'local.txt'), 'local\n');
        await call('POST', '/commit', { message: 'Local', push: false });
        const merged = await call('POST', '/pull');
        expect(merged.body).toMatchObject({ updated: true, status: { ahead: 2, behind: 0, changes: [] } });
        expect((await git(dir, 'log', '--format=%p', '-n1')).trim().split(' ')).toHaveLength(2);
        expect(await chapterName(story, 'village')).toBe('Merged Village');
        expect(await readFile(path.join(dir, 'data', 'local.txt'), 'utf8')).toBe('local\n');
    });

    it('a pull sends one story event and no file events; the watcher keeps reporting hand edits', async () => {
        const { call, events, repo, dir } = await start({ watch: true });
        await setupPush(call, repo.url);
        const stream = await events();
        try {
            await pushedClone(repo, async (clone) => {
                await renameVillage(clone, 'Pulled Village');
                await writeFile(path.join(clone, 'data', 'characters', 'annie.ts'), '// emptied\n');
            });
            expect((await call('POST', '/pull')).body.updated).toBe(true);
            await settleBriefly();
            expect(stream.frames.filter((f) => f.event !== 'hello')).toEqual([
                { event: 'story', data: { type: 'story', reason: 'git' } },
            ]);

            await renameVillage(dir, 'Hand Village');
            await waitFor(() => stream.changes.some((e) => e.kind === 'chapter' && e.id === 'village'));
        } finally {
            stream.close();
        }
    });

    it('a checkout sends a story event; creating a branch does not', async () => {
        const { call, events, repo } = await start();
        await setupPush(call, repo.url);
        await pushedClone(repo, (clone) => renameVillage(clone, 'Feature Village'), 'feature');
        const stream = await events();
        try {
            await call('POST', '/checkout', { branch: 'draft', create: true });
            await call('POST', '/fetch');
            await call('POST', '/checkout', { branch: 'feature', create: false });
            await waitFor(() => stream.frames.some((f) => f.event === 'story'));
            expect(stream.frames.filter((f) => f.event === 'story')).toHaveLength(1);
        } finally {
            stream.close();
        }
    });

    it('a checkout reruns the load-time tsconfig migration', async () => {
        const { call, repo, dir } = await start();
        await setupPush(call, repo.url);
        await pushedClone(repo, (clone) => writeFile(path.join(clone, 'tsconfig.json'), '{ "include": [] }\n'), 'old');
        await call('POST', '/fetch');
        const res = await call('POST', '/checkout', { branch: 'old', create: false });
        expect(res.body.branch).toBe('old');
        expect(await readFile(path.join(dir, 'tsconfig.json'), 'utf8')).toBe(await storyTsconfig(dir));
        expect((await call('GET')).body.status.changes).toEqual([{ path: 'tsconfig.json', kind: 'modified' }]);
    });

    it('setup pull watches the new folder', async () => {
        const { call, story, events, repo, dir } = await start({ watch: true });
        await setupPush(call, repo.url);
        await pushedClone(repo, (clone) => renameVillage(clone, 'Repo Village'));
        const version = (await call('GET')).body.config.version;
        await call('DELETE', '/config', { version, removeRepo: true });
        await rm(path.join(dir, '.gitignore'));
        expect(await chapterName(story, 'village')).toBe('Village Chapter');

        const stream = await events();
        try {
            const res = await call('POST', '/setup', { remoteUrl: repo.url, branch: 'main', initial: 'pull' });
            expect(res.status).toBe(201);
            expect(await chapterName(story, 'village')).toBe('Repo Village');
            await waitFor(() => stream.frames.some((f) => f.event === 'story'));
            await settleBriefly();
            expect(stream.changes).toEqual([]);

            // a new file: the old watcher still reports edits of files it knew, not files added to the new folder
            await writeFile(path.join(dir, 'data', 'characters', 'bob.ts'), '// bob\n');
            await waitFor(() => stream.changes.some((e) => e.kind === 'entity' && e.id === 'characters/bob'));
        } finally {
            stream.close();
        }
    });

    it('setup pull replaces the story with the repo and refuses a repo that is not a story', async () => {
        const { call, repo, dir } = await start();
        await setupPush(call, repo.url);
        const clone = await cloneRepo(repo, 'clone');
        await writeFile(path.join(clone, 'data', 'from-repo.txt'), 'repo\n');
        await commitAndPush(clone, 'Repo file');
        const version = (await call('GET')).body.config.version;
        expect((await call('DELETE', '/config', { version, removeRepo: true })).status).toBe(204);
        await rm(path.join(dir, '.gitignore'));

        const res = await call('POST', '/setup', { remoteUrl: repo.url, branch: 'main', initial: 'pull' });
        expect([res.status, res.body.message]).toEqual([201, undefined]);
        expect(res.body.config.hasToken).toBe(false);
        expect(res.body.status).toMatchObject({ branch: 'main', upstream: 'origin/main', changes: [] });
        expect(await readFile(path.join(dir, 'data', 'from-repo.txt'), 'utf8')).toBe('repo\n');

        const other = await makeBareRepo();
        try {
            const junk = await cloneRepo(other, 'junk');
            await writeFile(path.join(junk, 'README.md'), 'not a story\n');
            await commitAndPush(junk, 'Junk');
            const current = (await call('GET')).body.config.version;
            await call('DELETE', '/config', { version: current, removeRepo: false });
            const refused = await call('POST', '/setup', { remoteUrl: other.url, branch: 'main', initial: 'pull' });
            expect(refused.status).toBe(400);
            expect(await readFile(path.join(dir, 'data', 'from-repo.txt'), 'utf8')).toBe('repo\n');
            expect((await call('GET')).body.config).toBeNull();
        } finally {
            await other.cleanup();
        }
    });

    it('validates the remote and refuses disabled stories', async () => {
        const { testApp, call, cookie } = await start({ git: { ...TEST_GIT_OPTIONS, allowFileRemotes: false } });
        for (const remoteUrl of ['file:///tmp/x', 'ssh://host/x', 'https://user:pw@host/x', 'ext::sh -c x']) {
            const res = await call('POST', '/setup', { remoteUrl, branch: 'main', initial: 'push' });
            expect(res.status).toBe(400);
        }
        const example = await login(testApp.base, 'example', { cookie });
        const res = await requestJson(`${testApp.base}/api/stories/example/git/setup`, 'POST', {
            body: { remoteUrl: 'https://example.com/x.git', branch: 'main', initial: 'push' },
            headers: { cookie: example },
        });
        expect([res.status, res.body.error]).toEqual([503, 'git_unavailable']);
        const getGit = await requestJson(`${testApp.base}/api/stories/example/git`, 'GET', {
            headers: { cookie: example },
        });
        expect(getGit.body).toEqual({ available: false, config: null, status: null });
    });

    it('updates the config: an empty token keeps it, null clears it, a stale version is refused', async () => {
        const { call, repo } = await start();
        const setup = await setupPush(call, repo.url);
        const kept = await call('PUT', '/config', { version: setup.body.config.version, token: '', authorName: 'Me' });
        expect(kept.body.config).toMatchObject({ hasToken: true, authorName: 'Me', version: '2' });
        const stale = await call('PUT', '/config', { version: '1', token: null });
        expect([stale.status, stale.body.error, stale.body.current.config.version]).toEqual([409, 'stale', '2']);
        const cleared = await call('PUT', '/config', { version: '2', token: null });
        expect(cleared.body.config).toMatchObject({ hasToken: false, version: '3' });
    });

    it('serializes concurrent commits', async () => {
        const { call, repo, dir } = await start();
        await setupPush(call, repo.url);
        await writeFile(path.join(dir, 'data', 'a.txt'), 'a\n');
        await writeFile(path.join(dir, 'data', 'b.txt'), 'b\n');
        const results = await Promise.all(
            ['One', 'Two', 'Three'].map((message) => call('POST', '/commit', { message, push: false }))
        );
        expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
        expect(results.filter((r) => r.status === 409).map((r) => r.body.error)).toEqual([
            'git_nothing_to_commit',
            'git_nothing_to_commit',
        ]);
        expect((await git(dir, 'log', '--format=%s')).trim().split('\n')).toHaveLength(2);
    });

    it('the story_git row goes with the story row', async () => {
        const { testApp, call, repo } = await start();
        await setupPush(call, repo.url);
        const db = testApp.app.get(DataSource);
        expect(await db.query('SELECT storyId FROM story_git')).toEqual([{ storyId: 'alpha' }]);
        await db.query('DELETE FROM story WHERE id = ?', ['alpha']);
        expect(await db.query('SELECT storyId FROM story_git')).toEqual([]);
    });

    it('an export holds no .git, and an import zip with a .git is refused', async () => {
        const { testApp, call, cookie, repo } = await start();
        await setupPush(call, repo.url);
        const res = await fetch(`${testApp.base}/api/stories/alpha/export`, { headers: { cookie } });
        expect(res.status).toBe(200);
        const files: Zippable = unzipSync(new Uint8Array(await res.arrayBuffer()));
        const names = Object.keys(files);
        expect(names).toContain('tsconfig.json');
        expect(names.filter((name) => name.startsWith('.git'))).toEqual([]);

        files['.git/config'] = new TextEncoder().encode('[core]\n');
        const form = storyImportForm(new Blob([new Uint8Array(zipSync(files))]), {
            name: 'With git',
            author: 'Importer',
            password: 'secret-1',
            description: '',
            public: false,
        });
        const imported = await fetch(`${testApp.base}/api/stories/import`, { method: 'POST', body: form });
        expect(imported.status).toBe(400);
        expect((await imported.json()).message).toContain('.git');
    });

    it('every git route is editor-only', () => {
        const gitRoutes = STORY_ROUTE_NAMES.filter((route) => routeTemplate(route).includes('/git'));
        expect(gitRoutes).toHaveLength(10);
        for (const route of gitRoutes) expect(routeDef(route).access).toBe('write');
    });
});
