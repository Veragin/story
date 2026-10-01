import path from 'node:path';

// mirrors the protocol's STORY_ID_PATTERN: a service may not import another service
export const STORY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const VIRTUAL_STORY_PREFIX = 'virtual:story/';

export type TStoryRequest = { kind: 'engine' } | { kind: 'story'; storyId: string } | { kind: 'deny'; reason: string };

export type TStoryRequestContext = {
    root: string;
    storiesRoot: string;
    // throws for a missing path, like `fs.realpathSync`
    realpath: (p: string) => string;
    // the guard runs before Vite strips the base off the URL
    base?: string;
};

// may be stacked (`/@id//@fs/…`), so they are peeled off in a loop
const VITE_PREFIXES = ['/@fs/', '/@id/', '__x00__', '\0'];

const MAX_DECODES = 4;

// Security boundary: rather than predict how Vite reads the URL, check every reading and take the strictest.
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
    return verdictOf(storyIds);
};

const verdictOf = (storyIds: Set<string>): TStoryRequest => {
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

    return verdictOf(storyIds);
};

const peelPrefixes = (p: string): string[] => {
    const forms = new Set([p]);
    const queue = [p];
    for (let current = queue.pop(); current !== undefined; current = queue.pop()) {
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
    return verdictOf(storyIds);
};

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

export type TStoryAccessFetch = (storyId: string, cookie: string) => Promise<{ canPlay: boolean }>;

// cached as a promise: one story load is dozens of concurrent module requests
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

    const fetchCanPlay = async (storyId: string, cookie: string) =>
        (await fetchAccess(storyId, cookie)).canPlay === true;

    const evictOnFailure = async (key: string, canPlay: Promise<boolean>) => {
        try {
            await canPlay;
        } catch {
            if (entries.get(key)?.canPlay === canPlay) entries.delete(key);
        }
    };

    return (storyId: string, cookie: string): Promise<boolean> => {
        const key = `${storyId}\n${cookie}`;
        const t = now();
        const hit = entries.get(key);
        if (hit && hit.expiresAt > t) return hit.canPlay;

        if (entries.size >= maxEntries) {
            for (const [k, e] of entries) if (e.expiresAt <= t) entries.delete(k);
            const oldest = entries.keys().next();
            if (entries.size >= maxEntries && !oldest.done) entries.delete(oldest.value);
        }
        const canPlay = fetchCanPlay(storyId, cookie);
        entries.set(key, { expiresAt: t + ttlMs, canPlay });
        void evictOnFailure(key, canPlay);
        return canPlay;
    };
};
