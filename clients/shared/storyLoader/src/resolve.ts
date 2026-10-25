import { StoryLoaderError } from './StoryLoaderError';
import type { THostModuleFamilies, THostModules, TModuleExports } from './types';

export type TResolved = { kind: 'host'; exports: TModuleExports } | { kind: 'file'; path: string };

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

const CODE_EXTENSIONS = ['.ts', '.tsx'];

const isCodeFile = (path: string) => CODE_EXTENSIONS.some((ext) => path.endsWith(ext));

// how bundler resolution finds a module: as written, `.js` meaning `.ts(x)`, then `.ts(x)`, then a folder's index
const candidates = (path: string) => [
    path,
    ...(path.endsWith('.js') ? CODE_EXTENSIONS.map((ext) => `${path.slice(0, -3)}${ext}`) : []),
    ...CODE_EXTENSIONS.map((ext) => `${path}${ext}`),
    ...CODE_EXTENSIONS.map((ext) => `${path}/index${ext}`),
];

const storyPackageOf = (specifier: string): { root: string; rest: string } | null => {
    const [scope, name, ...rest] = specifier.split('/');
    const root = STORY_PACKAGES[`${scope}/${name}`];
    return root === undefined ? null : { root, rest: rest.join('/') };
};

const hasOwn = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

type TFamilyMember = { prefix: string; name: string };

const familyMemberOf = (specifier: string, families: THostModuleFamilies): TFamilyMember | null => {
    const slash = specifier.lastIndexOf('/');
    const prefix = specifier.slice(0, slash);
    const name = specifier.slice(slash + 1);
    return slash > 0 && name !== '' && hasOwn(families, prefix) ? { prefix, name } : null;
};

const supported = (hostModules: THostModules, families: THostModuleFamilies) =>
    [
        'relative paths',
        ...Object.keys(STORY_PACKAGES),
        ...Object.keys(hostModules),
        ...Object.keys(families).map((prefix) => `${prefix}/…`),
    ].join(', ');

export const createResolver = (
    files: readonly string[],
    hostModules: THostModules,
    families: THostModuleFamilies = {}
) => {
    const known = new Set(files);

    const findFile = (target: string, specifier: string, importer: string): string => {
        const path = candidates(target).find((c) => isCodeFile(c) && known.has(c));
        if (path === undefined) {
            throw new StoryLoaderError(
                importer,
                `cannot find "${specifier}" (looked for ${target}.ts(x) and ${target}/index.ts(x))`
            );
        }
        return path;
    };

    // CommonJS interop: without `__esModule` a default import would get the whole object
    const familyExports = (specifier: string, importer: string, { prefix, name }: TFamilyMember): TModuleExports => {
        const value = families[prefix](name);
        if (value === undefined) throw new StoryLoaderError(importer, `cannot import "${specifier}": no such module`);
        return { __esModule: true, default: value };
    };

    const inside = (path: string | null, root: string, specifier: string, importer: string): string => {
        if (path === null || (path !== root && !path.startsWith(`${root}/`))) {
            throw new StoryLoaderError(importer, `"${specifier}" leaves the story's ${root}/ folder`);
        }
        return path;
    };

    return (specifier: string, importer: string): TResolved => {
        if (hasOwn(hostModules, specifier)) return { kind: 'host', exports: hostModules[specifier] };

        const member = familyMemberOf(specifier, families);
        if (member !== null) return { kind: 'host', exports: familyExports(specifier, importer, member) };

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
            `cannot import "${specifier}": a story may import only ${supported(hostModules, families)}`
        );
    };
};

export type TResolver = ReturnType<typeof createResolver>;
