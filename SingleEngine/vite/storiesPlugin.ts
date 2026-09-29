import { existsSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Connect, Plugin, ResolvedConfig } from 'vite';
import {
    classifyStoryRequest,
    createStoryAccessCache,
    STORY_ID_PATTERN,
    type TStoryAccessFetch,
    VIRTUAL_STORY_PREFIX,
} from './storyGuard';

/** The resolved id of `virtual:story/<id>` (Rollup's `\0` convention for a module with no file). */
const RESOLVED_PREFIX = `\0${VIRTUAL_STORY_PREFIX}`;

/** `@story/types`, `@story/data`, `@story/data/<path>`: the names that mean a different story per importer. */
const STORY_SPECIFIER = /^@story\/(data|types)(?:\/(.*))?$/;

type TOptions = {
    /** The folder holding one folder per story; the Visualizer server's `STORIES_ROOT`. */
    storiesRoot: string;
    /** Base URL of the Visualizer server, which answers `GET /api/stories/:id/access`. */
    visualizerServer: string;
};

/**
 * `story:stories` (multiple stories, phase 9): SingleEngine plays any story under `STORIES_ROOT`,
 * picked at run time by `?story=<id>` (`src/main.tsx`), instead of bundling one.
 *
 *  - **`virtual:story/<id>`** is the story's entry: everything `stories/<id>/data/index.ts` exports
 *    (`register`, `itemInfo`) plus `images`, the URL of every `.png` under its `data/` keyed by the
 *    path relative to `data/` (`src/images.ts` turns that into the art lookups). The app imports it
 *    by URL (`/@id/__x00__virtual:story/<id>`), so no story is in the app's static graph.
 *  - **`@story/types` / `@story/data`** resolve per importer: from a file inside `stories/<id>/`
 *    they are that story's `types/` and `data/`, so each story binds to its own type universe.
 *    From anywhere else they are an error: the engine imports them type-only (erased), and a value
 *    import from the app would silently bind it to one story.
 *  - **The guard**: every request that reaches a file under `STORIES_ROOT/<id>/` or the virtual
 *    module (`storyGuard.ts#classifyStoryRequest` lists the URL shapes) needs `canPlay` from
 *    `GET /api/stories/:id/access`, asked with the browser's own `Cookie` and cached ~30 s, else
 *    `403`. This middleware is what keeps a private story's source out of the browser, so it runs
 *    ahead of all of Vite's own (a `configureServer` middleware added directly, not returned).
 *  - **Watch**: `STORIES_ROOT` is added to the watcher, so new stories and files hot-reload; an
 *    added or deleted `.png` reloads the page, because the story's `images` changed.
 */
export const storiesPlugin = ({ storiesRoot, visualizerServer }: TOptions): Plugin => {
    // one spelling of every story path: the real one, so a symlinked STORIES_ROOT gives no duplicates
    const root = existsSync(storiesRoot) ? realpathSync(storiesRoot) : path.resolve(storiesRoot);
    let config: ResolvedConfig;

    /** The story a file (a module id, maybe with a query) lies in, or `null`. */
    const storyOfFile = (file: string): string | null => {
        const rel = path.relative(root, file.split('?', 1)[0]);
        if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
        const id = rel.split(path.sep, 1)[0];
        return STORY_ID_PATTERN.test(id) ? id : null;
    };

    const storyEntry = (id: string) => path.join(root, id, 'data', 'index.ts');

    /** The dev-server URL of a file, the one Vite would give it (`/@fs/…` outside `root`). */
    const fileUrl = (file: string) => {
        const rel = path.relative(config.root, file);
        const inRoot = !rel.startsWith('..') && !path.isAbsolute(rel);
        return config.base + (inRoot ? rel.split(path.sep).join('/') : `@fs${file.split(path.sep).join('/')}`);
    };

    /** Every `.png` under the story's `data/`, keyed by its path relative to `data/` (`/`-separated). */
    const storyImages = (id: string): Record<string, string> => {
        const dataDir = path.join(root, id, 'data');
        const files = readdirSync(dataDir, { recursive: true, encoding: 'utf8' })
            .map((rel) => rel.split(path.sep).join('/'))
            .filter((rel) => rel.endsWith('.png') && !rel.split('/').includes('node_modules'))
            .sort();
        return Object.fromEntries(files.map((rel) => [rel, fileUrl(path.join(dataDir, rel))]));
    };

    const fetchAccess: TStoryAccessFetch = async (storyId, cookie) => {
        const res = await fetch(`${visualizerServer}/api/stories/${encodeURIComponent(storyId)}/access`, {
            headers: cookie ? { cookie } : {},
            signal: AbortSignal.timeout(5000),
        });
        // an unknown story: nothing to play (the virtual module will not resolve either)
        if (res.status === 404) return { canPlay: false };
        if (!res.ok) throw new Error(`GET access of "${storyId}": ${res.status}`);
        return (await res.json()) as { canPlay: boolean };
    };
    const canPlay = createStoryAccessCache({ fetchAccess });

    const guard: Connect.NextHandleFunction = (req, res, next) => {
        const verdict = classifyStoryRequest(req.url ?? '/', {
            root: config.root,
            storiesRoot: root,
            realpath: realpathSync,
            base: config.base,
        });
        if (verdict.kind === 'engine') return next();
        const refuse = (status: number, message: string) => {
            res.statusCode = status;
            res.setHeader('content-type', 'text/plain; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(message);
        };
        if (verdict.kind === 'deny') return refuse(403, `Forbidden: ${verdict.reason}`);
        canPlay(verdict.storyId, req.headers.cookie ?? '').then(
            (ok) => (ok ? next() : refuse(403, `Story "${verdict.storyId}" is locked: log in with its password first`)),
            (e: unknown) => {
                config.logger.error(`[story:stories] access check failed: ${String(e)}`);
                refuse(502, 'Could not check access to the story (is the Visualizer server running?)');
            }
        );
    };

    return {
        name: 'story:stories',
        enforce: 'pre',
        configResolved(resolved) {
            config = resolved;
        },
        async resolveId(source, importer) {
            if (source.startsWith(VIRTUAL_STORY_PREFIX) || source.startsWith(RESOLVED_PREFIX)) {
                const id = source.slice(source.indexOf(VIRTUAL_STORY_PREFIX) + VIRTUAL_STORY_PREFIX.length);
                return STORY_ID_PATTERN.test(id) && existsSync(storyEntry(id)) ? RESOLVED_PREFIX + id : null;
            }
            const match = STORY_SPECIFIER.exec(source);
            if (!match) return null;
            const storyId = importer ? storyOfFile(importer) : null;
            if (storyId === null) {
                this.error(
                    `"${source}" imported from ${importer ?? 'no importer'}: it means a different story per ` +
                        'importer and resolves only from a file inside stories/<id>/. Import it type-only, ' +
                        'or get the story from the engine (`engine.storyModule`).'
                );
            }
            const [, pkg, sub] = match;
            const pkgDir = path.join(root, storyId, pkg);
            if (sub === undefined) return path.join(pkgDir, 'index.ts');
            const target = path.resolve(pkgDir, sub);
            if (!target.startsWith(pkgDir + path.sep)) this.error(`"${source}" leaves the story's ${pkg}/`);
            // never `null`: that would hand the specifier on to node resolution, i.e. the example
            const resolved = await this.resolve(target, importer, { skipSelf: true });
            if (!resolved) this.error(`"${source}" from ${importer}: no such file in the story`);
            return resolved;
        },
        load(id) {
            if (!id.startsWith(RESOLVED_PREFIX)) return null;
            const storyId = id.slice(RESOLVED_PREFIX.length);
            return [
                `export * from ${JSON.stringify(storyEntry(storyId))};`,
                `export const images = ${JSON.stringify(storyImages(storyId))};`,
            ].join('\n');
        },
        configureServer(server) {
            server.middlewares.use(guard);
            server.watcher.add(root);
            const onImageAddedOrDeleted = (file: string) => {
                const storyId = file.endsWith('.png') ? storyOfFile(file) : null;
                const mod = storyId && server.moduleGraph.getModuleById(RESOLVED_PREFIX + storyId);
                if (!mod) return;
                server.moduleGraph.invalidateModule(mod);
                server.ws.send({ type: 'full-reload' });
            };
            server.watcher.on('add', onImageAddedOrDeleted);
            server.watcher.on('unlink', onImageAddedOrDeleted);
        },
    };
};
