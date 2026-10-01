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

const RESOLVED_PREFIX = `\0${VIRTUAL_STORY_PREFIX}`;

const STORY_SPECIFIER = /^@story\/(data|types)(?:\/(.*))?$/;

type TOptions = {
    storiesRoot: string;
    visualizerServer: string;
};

export const storiesPlugin = ({ storiesRoot, visualizerServer }: TOptions): Plugin => {
    // the real path, so a symlinked STORIES_ROOT gives no duplicates
    const root = existsSync(storiesRoot) ? realpathSync(storiesRoot) : path.resolve(storiesRoot);
    let config: ResolvedConfig;

    const storyOfFile = (file: string): string | null => {
        const rel = path.relative(root, file.split('?', 1)[0]);
        if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
        const id = rel.split(path.sep, 1)[0];
        return STORY_ID_PATTERN.test(id) ? id : null;
    };

    const storyEntry = (id: string) => path.join(root, id, 'data', 'index.ts');

    const fileUrl = (file: string) => {
        const rel = path.relative(config.root, file);
        const inRoot = !rel.startsWith('..') && !path.isAbsolute(rel);
        return config.base + (inRoot ? rel.split(path.sep).join('/') : `@fs${file.split(path.sep).join('/')}`);
    };

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
        if (res.status === 404) return { canPlay: false };
        if (!res.ok) throw new Error(`GET access of "${storyId}": ${res.status}`);
        const access: { canPlay: boolean } = await res.json();
        return access;
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
        const admitIfPlayable = async (storyId: string) => {
            let ok: boolean;
            try {
                ok = await canPlay(storyId, req.headers.cookie ?? '');
            } catch (e: unknown) {
                config.logger.error(`[story:stories] access check failed: ${String(e)}`);
                refuse(502, 'Could not check access to the story (is the Visualizer server running?)');
                return;
            }
            if (ok) next();
            else refuse(403, `Story "${storyId}" is locked: log in with its password first`);
        };
        void admitIfPlayable(verdict.storyId);
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
            // never `null`: node resolution would bind the specifier to the example story
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
