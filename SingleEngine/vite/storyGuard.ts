import path from 'node:path';

/**
 * The pure half of SingleEngine's story guard (multiple stories, phase 9): which story a dev-server
 * request reaches, and whether this browser may play it. `storiesPlugin.ts` wires both into Vite.
 * Kept free of Vite and of I/O (the file system and `fetch` come in as parameters) so it can be
 * tested on its own (`test/storyGuard.test.ts`).
 */

/**
 * A story id (plan D3), the folder name under `STORIES_ROOT`. The same pattern as the protocol's
 * `STORY_ID_PATTERN` (`Visualizer/protocol/src/dto/story.ts`), repeated here because a service may
 * not import another service. Temp folders (`.create-*`, `.import-*`) never match.
 */
export const STORY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** The virtual module of a story: `virtual:story/<id>` (see `storiesPlugin.ts`). */
export const VIRTUAL_STORY_PREFIX = 'virtual:story/';

/**
 * What a request reaches:
 *  - `engine`: nothing of any story (the app, the engine packages, `/api`, Vite's own URLs)
 *  - `story`: a file of story `storyId`, or its virtual module; needs `canPlay` for that story
 *  - `deny`: something under `STORIES_ROOT` that is not a story file (the root itself, a temp or
 *    oddly named folder), more than one story at once, or a URL that cannot be decoded. Always 403.
 */
export type TStoryRequest = { kind: 'engine' } | { kind: 'story'; storyId: string } | { kind: 'deny'; reason: string };

export type TStoryRequestContext = {
    /** Vite's `root` (`SingleEngine/`): a URL like `/src/main.tsx` or `/../x` is relative to it. */
    root: string;
    /** The folder holding one folder per story (`STORIES_ROOT`). */
    storiesRoot: string;
    /**
     * The real path of an existing path, following symlinks (`fs.realpathSync`); throws when it
     * does not exist. It catches the workspace symlinks (`node_modules/@story/data` → the example).
     */
    realpath: (p: string) => string;
    /**
     * Vite's `base` (`/` unless `ENGINE_BASE` sets one, e.g. `/play/`). The guard runs ahead of
     * Vite's own middlewares, i.e. before Vite takes the base off the URL, so `/play/@fs/…` must be
     * read as `/@fs/…` too. Default `/`.
     */
    base?: string;
};

/**
 * Prefixes under which Vite finds a module by something other than its root-relative URL:
 * `/@fs/<absolute path>`, `/@id/<id>` and `__x00__` / `\0` (a virtual id). They may be stacked
 * (`/@id//@fs/…` resolves too), so they are peeled off in a loop.
 */
const VITE_PREFIXES = ['/@fs/', '/@id/', '__x00__', '\0'];

/** How many times a URL is decoded at most (`%252e` → `%2e` → `.`); more is refused. */
const MAX_DECODES = 4;

/**
 * Which story (if any) the dev-server request `url` reaches. This is the security boundary that
 * keeps a locked story's source out of the browser, so it errs on the side of `deny`: it does not
 * try to predict the one way Vite will read the URL, it tries every reading and takes the
 * strictest answer.
 *
 * The path (before the first raw `?` / `#`) is decoded until it stops changing, backslashes become
 * slashes, and then every interpretation of it is checked:
 *  - anything mentioning `virtual:story/` names its story (`/@id/virtual:story/x`,
 *    `/@id/__x00__virtual:story/x`, …), whatever surrounds it
 *  - a bare `@story/data` / `@story/types` specifier (`/@id/@story/data`) is refused: it only
 *    means something relative to an importer inside a story, never as a URL
 *  - as written and normalized (`..` collapsed, as `new URL` and `path.resolve` do), with the Vite
 *    prefixes above peeled off, each result read both as an absolute file (`/@fs/…`) and as a path
 *    under `root` (`/../stories/…`), and then followed through symlinks. A result under
 *    `STORIES_ROOT` names the story of its first segment.
 *
 * A path that decodes to one containing `?` / `#` (`%3F`) is checked both whole and cut there.
 * Under a `base` other than `/`, each path that starts with it is checked with and without it.
 */
export const classifyStoryRequest = (url: string, ctx: TStoryRequestContext): TStoryRequest => {
    const rawPath = url.split(/[?#]/, 1)[0];
    let decoded = rawPath;
    for (let i = 0; ; i++) {
        let next: string;
        try {
            next = decodeURIComponent(decoded);
        } catch {
            return { kind: 'deny', reason: 'undecodable URL' };
        }
        if (next === decoded) break;
        if (i === MAX_DECODES) return { kind: 'deny', reason: 'URL encoded too many times' };
        decoded = next;
    }
    decoded = decoded.replace(/\\/g, '/');

    const paths = new Set([decoded, decoded.split(/[?#]/, 1)[0]]);
    const base = ctx.base ?? '/';
    if (base !== '/') {
        for (const p of [...paths]) if (p.startsWith(base)) paths.add(`/${p.slice(base.length)}`);
    }
    const storyIds = new Set<string>();
    for (const p of paths) {
        const verdict = classifyPath(p, ctx);
        if (verdict.kind === 'deny') return verdict;
        if (verdict.kind === 'story') storyIds.add(verdict.storyId);
    }
    if (storyIds.size > 1) return { kind: 'deny', reason: 'more than one story' };
    const [storyId] = storyIds;
    return storyId === undefined ? { kind: 'engine' } : { kind: 'story', storyId };
};

const classifyPath = (p: string, ctx: TStoryRequestContext): TStoryRequest => {
    const storyIds = new Set<string>();

    const virtualAt = p.indexOf(VIRTUAL_STORY_PREFIX);
    if (virtualAt !== -1) {
        const id = p.slice(virtualAt + VIRTUAL_STORY_PREFIX.length).split('/', 1)[0];
        if (!STORY_ID_PATTERN.test(id)) return { kind: 'deny', reason: 'not a story id' };
        storyIds.add(id);
    }

    for (const form of [p, path.posix.normalize(p)]) {
        for (const stripped of peelPrefixes(form)) {
            if (/^@story\/(data|types)(\/|$)/.test(stripped)) {
                return { kind: 'deny', reason: 'a story specifier without an importer' };
            }
            const files = stripped.startsWith('/')
                ? [path.resolve(stripped), path.resolve(ctx.root, `.${stripped}`)]
                : [path.resolve(ctx.root, stripped)];
            for (const file of files) {
                const verdict = storyOfFile(file, ctx);
                if (verdict.kind === 'deny') return verdict;
                if (verdict.kind === 'story') storyIds.add(verdict.storyId);
            }
        }
    }

    if (storyIds.size > 1) return { kind: 'deny', reason: 'more than one story' };
    const [storyId] = storyIds;
    return storyId === undefined ? { kind: 'engine' } : { kind: 'story', storyId };
};

/**
 * `p`, then `p` without each Vite prefix in turn (`/@id//@fs/x` → `/@fs/x` → `/x`). After a
 * `/@id/` or `/@fs/` both the absolute (`/x`) and the bare (`x`) reading go on.
 */
const peelPrefixes = (p: string): string[] => {
    const forms = new Set([p]);
    const queue = [p];
    while (queue.length > 0) {
        const current = queue.pop()!;
        const prefix = VITE_PREFIXES.find((pre) => current.startsWith(pre));
        if (!prefix) continue;
        // `/@fs/` and `/@id/` keep their trailing slash: `/@fs/app/x` is the file `/app/x`
        const rest = prefix.endsWith('/') ? current.slice(prefix.length - 1) : current.slice(prefix.length);
        for (const next of rest.startsWith('/') ? [rest, rest.slice(1)] : [rest]) {
            if (forms.has(next)) continue;
            forms.add(next);
            queue.push(next);
        }
    }
    return [...forms];
};

/** The story `file` belongs to, both as written and through symlinks. */
const storyOfFile = (file: string, ctx: TStoryRequestContext): TStoryRequest => {
    const storyIds = new Set<string>();
    const roots = new Set([path.resolve(ctx.storiesRoot), realpathLoose(path.resolve(ctx.storiesRoot), ctx)]);
    for (const candidate of new Set([file, realpathLoose(file, ctx)])) {
        for (const root of roots) {
            const rel = path.relative(root, candidate);
            if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) continue;
            const id = rel.split(path.sep, 1)[0];
            if (rel === '' || !STORY_ID_PATTERN.test(id)) {
                return { kind: 'deny', reason: 'not a story folder' };
            }
            storyIds.add(id);
        }
    }
    if (storyIds.size > 1) return { kind: 'deny', reason: 'more than one story' };
    const [storyId] = storyIds;
    return storyId === undefined ? { kind: 'engine' } : { kind: 'story', storyId };
};

/**
 * The real path of `p` even when it does not exist: the longest existing ancestor is resolved
 * through symlinks and the rest appended.
 */
const realpathLoose = (p: string, ctx: TStoryRequestContext): string => {
    const rest: string[] = [];
    for (let current = p; ; ) {
        try {
            return path.join(ctx.realpath(current), ...rest);
        } catch {
            const parent = path.dirname(current);
            if (parent === current) return p;
            rest.unshift(path.basename(current));
            current = parent;
        }
    }
};

/** `GET /api/stories/:id/access`, trimmed to what the guard needs. */
export type TStoryAccessFetch = (storyId: string, cookie: string) => Promise<{ canPlay: boolean }>;

/**
 * `canPlay` for a story and a browser (its `Cookie` header), asked of the Visualizer server and
 * kept for `ttlMs`. One story load is dozens of module requests at once, so the answer is cached
 * as a promise: they all share one server call. A failed call is not cached (and is the caller's
 * to refuse). A cached `true` outlives a logout or a story made private by at most `ttlMs`.
 */
export const createStoryAccessCache = ({
    fetchAccess,
    ttlMs = 30_000,
    now = Date.now,
    maxEntries = 1000,
}: {
    fetchAccess: TStoryAccessFetch;
    ttlMs?: number;
    now?: () => number;
    maxEntries?: number;
}) => {
    const entries = new Map<string, { expiresAt: number; canPlay: Promise<boolean> }>();

    return (storyId: string, cookie: string): Promise<boolean> => {
        const key = `${storyId}\n${cookie}`;
        const t = now();
        const hit = entries.get(key);
        if (hit && hit.expiresAt > t) return hit.canPlay;

        if (entries.size >= maxEntries) {
            for (const [k, e] of entries) if (e.expiresAt <= t) entries.delete(k);
            // still full of live entries: drop the oldest
            if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
        }
        const canPlay = fetchAccess(storyId, cookie).then((a) => a.canPlay === true);
        entries.set(key, { expiresAt: t + ttlMs, canPlay });
        canPlay.catch(() => {
            if (entries.get(key)?.canPlay === canPlay) entries.delete(key);
        });
        return canPlay;
    };
};
