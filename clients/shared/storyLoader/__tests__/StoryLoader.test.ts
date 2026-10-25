import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorldState, isStoryModule } from '@story/core';
import { DeltaTime } from '@story/shared';
import { StoryLoaderError } from '../src';
import { exampleStoryTexts, HOST_MODULES, loaderFor, memorySource } from './support/memorySource';

const isPassageFile = (file: string) => file.includes('.passages');

const chapterPassageFiles = (files: string[], chapterId: string) =>
    files.filter((f) => f.startsWith(`data/chapters/${chapterId}/`) && isPassageFile(f));

const loadExample = async () => {
    const source = memorySource(exampleStoryTexts());
    const story = await loaderFor(source).import('@story/data');
    if (!isStoryModule(story)) throw new Error('the example is not a story module');
    return { source, story };
};

describe('the example story', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('loads and plays', async () => {
        const { story } = await loadExample();
        const { e } = createWorldState(story, 'example');

        await e.startAs('thomas');

        await vi.waitFor(() => expect(e.store.passage?.id).toBe('intro'));
        expect(e.store.passage?.characterId).toBe('thomas');
    });

    it('fetches a chapter`s passages only when the chapter is played', async () => {
        const { source, story } = await loadExample();
        expect(source.fetched.filter(isPassageFile)).toEqual([]);

        const kingdom = await story.register.passages.kingdom();

        expect(Object.keys(kingdom.default)).toContain('kingdom-annie-intro');
        expect(source.fetched.filter(isPassageFile).sort()).toEqual(
            chapterPassageFiles(source.files, 'kingdom').sort()
        );
    });

    it('fetches every file once', async () => {
        const { source, story } = await loadExample();
        await Promise.all([story.register.passages.village(), story.register.passages.village()]);

        expect(new Set(source.fetched).size).toBe(source.fetched.length);
    });
});

describe('modules', () => {
    it('runs import cycles like CommonJS', async () => {
        const source = memorySource({
            'data/index.ts': `export { ping } from './a';`,
            'data/a.ts': `import { pong } from './b';\nexport const ping = (n: number): string => (n === 0 ? 'ping' : pong(n - 1));`,
            'data/b.ts': `import { ping } from './a';\nexport const pong = (n: number): string => (n === 0 ? 'pong' : ping(n - 1));`,
        });

        const { ping } = await loaderFor(source).import('@story/data');

        expect(typeof ping === 'function' && ping(3)).toBe('pong');
    });

    it('resolves folders, `@story/types` and `@story/data/…` deep imports', async () => {
        const source = memorySource({
            'data/index.ts': `import { a } from './sub';\nimport { t } from '@story/types';\nimport { c } from '@story/data/sub/c';\nexport const all = [a, t, c];`,
            'data/sub/index.ts': `export const a = 'a';`,
            'data/sub/c.ts': `export const c = 'c';`,
            'types/index.ts': `export type T = string;\nexport const t: T = 't';`,
        });

        expect((await loaderFor(source).import('@story/data')).all).toEqual(['a', 't', 'c']);
    });

    it('shares the host modules with the app', async () => {
        const source = memorySource({
            'data/index.ts': `import { DeltaTime } from '@story/shared';\nexport const cost = DeltaTime.fromMin(5);\nexport const hello = _('Hello');`,
        });

        const story = await loaderFor(source).import('@story/data');

        expect(story.cost).toBeInstanceOf(DeltaTime);
        expect(story.hello).toBe('Hello');
    });

    it('names the importing file for an unknown specifier', async () => {
        const source = memorySource({ 'data/index.ts': `import { x } from 'lodash';\nexport const y = x;` });

        const loading = loaderFor(source).import('@story/data');

        await expect(loading).rejects.toBeInstanceOf(StoryLoaderError);
        await expect(loading).rejects.toThrow(/data\/index\.ts: cannot import "lodash"/);
    });

    it('names the importing file for a missing file', async () => {
        const source = memorySource({ 'data/index.ts': `export * from './missing';` });

        await expect(loaderFor(source).import('@story/data')).rejects.toThrow(
            /data\/index\.ts: cannot find "\.\/missing"/
        );
    });

    it('names the file that fails to run', async () => {
        const source = memorySource({ 'data/index.ts': `throw new Error('boom');` });

        await expect(loaderFor(source).import('@story/data')).rejects.toThrow('data/index.ts: failed to run: boom');
    });
});

describe('TSX', () => {
    const element = (type: unknown, props: unknown) => ({ type, props });
    const JSX_RUNTIME = { jsx: element, jsxs: element, Fragment: 'Fragment' };
    const BOLT = 'BoltIcon';
    const ICONS: Readonly<Record<string, unknown>> = { Bolt: BOLT };
    const iconOf = (name: string) => ICONS[name];
    const hosts = {
        hostModules: { ...HOST_MODULES, 'react/jsx-runtime': JSX_RUNTIME },
        hostModuleFamilies: { '@mui/icons-material': iconOf },
    };

    it('compiles a `.tsx` file with the automatic runtime, found without an extension and as a folder index', async () => {
        const source = memorySource({
            'data/index.ts': `export { title } from './Title';\nexport { icon } from './icon';`,
            'data/Title.tsx': `export const title = <b title="t">{_('Hi')}</b>;`,
            'data/icon/index.tsx': `export const icon = <></>;`,
        });

        const story = await loaderFor(source, hosts).import('@story/data');

        expect(story.title).toEqual({ type: 'b', props: { title: 't', children: 'Hi' } });
        expect(story.icon).toEqual({ type: 'Fragment', props: {} });
    });

    it('rejects JSX in a `.ts` file', async () => {
        const source = memorySource({ 'data/index.ts': `export const title = <b>Hi</b>;` });

        await expect(loaderFor(source, hosts).import('@story/data')).rejects.toThrow(
            /data\/index\.ts: TypeScript \(JSX needs a \.tsx file\) failed/
        );
    });

    it('resolves a member of a host module family as its default export', async () => {
        const source = memorySource({
            'data/index.ts': `import Bolt from '@mui/icons-material/Bolt';\nexport const icon = Bolt;`,
        });

        expect((await loaderFor(source, hosts).import('@story/data')).icon).toBe(BOLT);
    });

    it('names the importing file for an unknown family member', async () => {
        const source = memorySource({
            'data/index.ts': `import Nope from '@mui/icons-material/Nope';\nexport const icon = Nope;`,
        });

        const loading = loaderFor(source, hosts).import('@story/data');

        await expect(loading).rejects.toBeInstanceOf(StoryLoaderError);
        await expect(loading).rejects.toThrow(
            'data/index.ts: cannot import "@mui/icons-material/Nope": no such module'
        );
    });
});
