import { StoryLoaderError } from './StoryLoaderError';
import type { THostModules } from './types';

export type TResolved = { kind: 'host'; specifier: string } | { kind: 'file'; path: string };

const STORY_PACKAGES: Readonly<Record<string, string>> = {
    '@story/data': 'data',
    '@story/types': 'types',
};

const dirname = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);

const normalize = (path: string): string | null => {
    const parts: string[] = [];
    for (const part of path.split('/')) {
        if (part === '' || part === '.') continue;
        if (part !== '..') parts.push(part);
        else if (parts.pop() === undefined) return null;
    }
    return parts.join('/');
};

// how bundler resolution finds a TS module: as written, `.js` meaning `.ts`, then `.ts`, then a folder's index
const candidates = (path: string) => [
    path,
    ...(path.endsWith('.js') ? [`${path.slice(0, -3)}.ts`] : []),
    `${path}.ts`,
    `${path}/index.ts`,
];

const storyPackageOf = (specifier: string): { root: string; rest: string } | null => {
    const [scope, name, ...rest] = specifier.split('/');
    const root = STORY_PACKAGES[`${scope}/${name}`];
    return root === undefined ? null : { root, rest: rest.join('/') };
};

const supported = (hostModules: THostModules) =>
    ['relative paths', ...Object.keys(STORY_PACKAGES), ...Object.keys(hostModules)].join(', ');

export const createResolver = (files: readonly string[], hostModules: THostModules) => {
    const known = new Set(files);

    const findFile = (target: string, specifier: string, importer: string): string => {
        const path = candidates(target).find((c) => c.endsWith('.ts') && known.has(c));
        if (path === undefined) {
            throw new StoryLoaderError(
                importer,
                `cannot find "${specifier}" (looked for ${target}.ts and ${target}/index.ts)`
            );
        }
        return path;
    };

    const inside = (path: string | null, root: string, specifier: string, importer: string): string => {
        if (path === null || (path !== root && !path.startsWith(`${root}/`))) {
            throw new StoryLoaderError(importer, `"${specifier}" leaves the story's ${root}/ folder`);
        }
        return path;
    };

    return (specifier: string, importer: string): TResolved => {
        if (Object.prototype.hasOwnProperty.call(hostModules, specifier)) return { kind: 'host', specifier };

        if (specifier.startsWith('./') || specifier.startsWith('../')) {
            const target = normalize(dirname(importer) + specifier);
            if (target === null) throw new StoryLoaderError(importer, `"${specifier}" leaves the story`);
            return { kind: 'file', path: findFile(target, specifier, importer) };
        }

        const pkg = storyPackageOf(specifier);
        if (pkg !== null) {
            const target = inside(normalize(`${pkg.root}/${pkg.rest}`), pkg.root, specifier, importer);
            return { kind: 'file', path: findFile(target, specifier, importer) };
        }

        throw new StoryLoaderError(
            importer,
            `cannot import "${specifier}": a story may import only ${supported(hostModules)}`
        );
    };
};

export type TResolver = ReturnType<typeof createResolver>;
