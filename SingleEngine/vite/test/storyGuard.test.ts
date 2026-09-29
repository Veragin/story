import { describe, expect, it, vi } from 'vitest';
import { classifyStoryRequest, createStoryAccessCache, type TStoryRequestContext } from '../storyGuard';

/**
 * A fake file system: `/app` is the repo, `/app/stories` holds `example` and `secret`, and the
 * workspace symlink `/app/node_modules/@story/data` points at the example's `data/` (as yarn makes
 * it). `realpath` throws for anything else that does not exist, like `fs.realpathSync`.
 */
const EXISTING = new Set([
    '/',
    '/app',
    '/app/SingleEngine',
    '/app/SingleEngine/src',
    '/app/SingleEngine/src/main.tsx',
    '/app/core',
    '/app/stories',
    '/app/stories/example',
    '/app/stories/example/data',
    '/app/stories/example/data/index.ts',
    '/app/stories/secret',
    '/app/stories/secret/data',
    '/app/stories/secret/data/index.ts',
    '/app/stories/secret/story.json',
    '/app/node_modules',
    '/app/node_modules/@story',
]);
const SYMLINKS: Record<string, string> = {
    '/app/node_modules/@story/data': '/app/stories/example/data',
    '/app/node_modules/@story/secret-link': '/app/stories/secret',
};
const realpath = (p: string): string => {
    for (const [link, target] of Object.entries(SYMLINKS)) {
        if (p === link || p.startsWith(`${link}/`)) return realpath(target + p.slice(link.length));
    }
    if (!EXISTING.has(p)) throw new Error(`ENOENT: ${p}`);
    return p;
};

const ctx: TStoryRequestContext = { root: '/app/SingleEngine', storiesRoot: '/app/stories', realpath };
const classify = (url: string) => classifyStoryRequest(url, ctx);
const story = (storyId: string) => ({ kind: 'story', storyId });

describe('classifyStoryRequest', () => {
    it.each([
        '/',
        '/?story=secret',
        '/src/main.tsx',
        '/src/main.tsx?t=123',
        '/@vite/client',
        '/@react-refresh',
        '/@fs/app/core/src/index.ts',
        '/@fs/app/ui/src/index.ts?import',
        '/node_modules/.vite/deps/react.js?v=1',
        '/@id/react',
        '/api/stories/secret/access',
        '/api/stories',
    ])('lets the engine request %s through', (url) => {
        expect(classify(url)).toEqual({ kind: 'engine' });
    });

    it.each([
        ['/@fs/app/stories/secret/data/index.ts', 'secret'],
        ['/@fs/app/stories/secret/data/index.ts?import', 'secret'],
        ['/@fs/app/stories/secret/data/index.ts?t=1700000000000', 'secret'],
        ['/@fs/app/stories/secret/data/chapters/start/start.chapter.ts?import&t=1', 'secret'],
        ['/@fs/app/stories/secret/data/characters/hero.png', 'secret'],
        ['/@fs/app/stories/secret/data/characters/hero.png?url', 'secret'],
        ['/@fs/app/stories/secret/data/nope.ts', 'secret'],
        ['/@fs/app/stories/example/data/index.ts', 'example'],
        // virtual module, every spelling
        ['/@id/__x00__virtual:story/secret', 'secret'],
        ['/@id/virtual:story/secret', 'secret'],
        ['/@id/__x00__virtual:story/secret?import', 'secret'],
        ['/virtual:story/secret', 'secret'],
        ['/@id/%5F%5Fx00%5F%5Fvirtual%3Astory%2Fsecret', 'secret'],
        ['/@id/%00virtual:story/secret', 'secret'],
        // relative to root, and `..` in every form
        ['/../stories/secret/data/index.ts', 'secret'],
        ['/@fs/app/SingleEngine/../stories/secret/data/index.ts', 'secret'],
        ['/@fs/app/stories/example/../secret/data/index.ts', 'secret'],
        ['/@fs/../app/stories/secret/data/index.ts', 'secret'],
        ['/%2e%2e/stories/secret/data/index.ts', 'secret'],
        ['/@fs/app/stories/%73ecret/data/index.ts', 'secret'],
        ['/@fs%2fapp%2fstories%2fsecret%2fdata%2findex.ts', 'secret'],
        ['/@fs/app/stories/secret%252fdata/index.ts', 'secret'],
        ['/@fs//app//stories/secret/data/index.ts', 'secret'],
        ['//app/stories/secret/data/index.ts', 'secret'],
        ['/@fs\\app\\stories\\secret\\data\\index.ts', 'secret'],
        // stacked prefixes
        ['/@id//@fs/app/stories/secret/data/index.ts', 'secret'],
        ['/@id/__x00__/app/stories/secret/data/index.ts', 'secret'],
        ['/@id//app/stories/secret/data/index.ts', 'secret'],
        ['/@id/../stories/secret/data/index.ts', 'secret'],
        // an encoded `?` does not hide the path from the check
        ['/@fs/app/stories/secret/data/index.ts%3Fimport', 'secret'],
        // through a symlink into a story
        ['/@fs/app/node_modules/@story/data/index.ts', 'example'],
        ['/../node_modules/@story/secret-link/data/index.ts', 'secret'],
    ])('names the story of %s', (url, storyId) => {
        expect(classify(url)).toEqual(story(storyId));
    });

    it.each([
        '/@fs/app/stories',
        '/@fs/app/stories/',
        '/@fs/app/stories/.create-abc/data/index.ts',
        '/@fs/app/stories/..hidden/x.ts',
        '/@fs/app/stories/Secret/data/index.ts',
        '/@fs/app/stories/notes.txt',
        '/@id/virtual:story/../secret',
        '/@id/virtual:story/',
        '/@id/@story/data',
        '/@id/@story/types',
        '/@id/@story/data/chapters/x.ts',
        '/@fs/app/stories/%E0%A4%A/x',
        '/@fs/app/stories/%2525252573ecret/data/index.ts',
        // two stories at once: refused, not checked against either
        '/@id/virtual:story/example/../../@fs/app/stories/secret/data/index.ts',
    ])('refuses %s', (url) => {
        expect(classify(url).kind).toBe('deny');
    });

    describe('under a base (ENGINE_BASE=/play/, the production proxy)', () => {
        // the guard sees the URL before Vite takes the base off
        const classifyUnder = (url: string) => classifyStoryRequest(url, { ...ctx, base: '/play/' });

        it.each([
            '/play/',
            '/play/?story=secret',
            '/play/src/main.tsx',
            '/play/@vite/client',
            '/play/@fs/app/core/src/index.ts',
        ])('lets the engine request %s through', (url) => {
            expect(classifyUnder(url)).toEqual({ kind: 'engine' });
        });

        it.each([
            ['/play/@fs/app/stories/secret/data/index.ts', 'secret'],
            ['/play/@fs/app/stories/secret/data/characters/hero.png?url', 'secret'],
            ['/play/@id/__x00__virtual:story/secret', 'secret'],
            ['/play/../stories/secret/data/index.ts', 'secret'],
            ['/play/%2e%2e/stories/secret/data/index.ts', 'secret'],
            ['/play/@id//@fs/app/stories/secret/data/index.ts', 'secret'],
            ['/play%2f@fs/app/stories/secret/data/index.ts', 'secret'],
            // without the base Vite answers 404 itself, but the guard still reads it
            ['/@fs/app/stories/secret/data/index.ts', 'secret'],
        ])('names the story of %s', (url, storyId) => {
            expect(classifyUnder(url)).toEqual(story(storyId));
        });

        it.each(['/play/@id/@story/data', '/play/@fs/app/stories/.create-abc/data/index.ts'])('refuses %s', (url) => {
            expect(classifyUnder(url).kind).toBe('deny');
        });
    });
});

describe('createStoryAccessCache', () => {
    it('asks the server once per story and cookie within the ttl', async () => {
        let t = 0;
        const fetchAccess = vi.fn((storyId: string, cookie: string) =>
            Promise.resolve({ canPlay: storyId === 'example' || cookie === 'story_session=ok' })
        );
        const canPlay = createStoryAccessCache({ fetchAccess, ttlMs: 30_000, now: () => t });

        const answers = await Promise.all([canPlay('secret', ''), canPlay('secret', ''), canPlay('secret', '')]);
        expect(answers).toEqual([false, false, false]);
        expect(fetchAccess).toHaveBeenCalledTimes(1);

        expect(await canPlay('secret', 'story_session=ok')).toBe(true);
        expect(await canPlay('example', '')).toBe(true);
        expect(fetchAccess).toHaveBeenCalledTimes(3);

        t = 29_999;
        await canPlay('secret', '');
        expect(fetchAccess).toHaveBeenCalledTimes(3);
        t = 30_000;
        await canPlay('secret', '');
        expect(fetchAccess).toHaveBeenCalledTimes(4);
    });

    it('does not cache a failed check', async () => {
        const fetchAccess = vi
            .fn<(storyId: string, cookie: string) => Promise<{ canPlay: boolean }>>()
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ canPlay: true });
        const canPlay = createStoryAccessCache({ fetchAccess });

        await expect(canPlay('secret', '')).rejects.toThrow('down');
        expect(await canPlay('secret', '')).toBe(true);
    });

    it('reads anything but `canPlay: true` as no', async () => {
        const canPlay = createStoryAccessCache({
            fetchAccess: () => Promise.resolve({ canPlay: 'yes' } as unknown as { canPlay: boolean }),
        });
        expect(await canPlay('secret', '')).toBe(false);
    });

    it('stays bounded', async () => {
        const fetchAccess = vi.fn(() => Promise.resolve({ canPlay: true }));
        const canPlay = createStoryAccessCache({ fetchAccess, maxEntries: 2, now: () => 0 });
        await canPlay('a', '');
        await canPlay('b', '');
        await canPlay('c', '');
        await canPlay('c', '');
        expect(fetchAccess).toHaveBeenCalledTimes(3);
        await canPlay('a', '');
        expect(fetchAccess).toHaveBeenCalledTimes(4);
    });
});
