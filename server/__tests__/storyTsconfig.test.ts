import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ts } from 'ts-morph';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_STORY_ROOT } from '../src/project/ProjectRoot';
import { migrateStoryTsconfig, storyTsconfig } from '../src/stories/storyTsconfig';
import { makeTempStoriesRoot, writeStoryFolder } from './helpers/storiesRoot';

const STALE_TSCONFIG = JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: {
        baseUrl: '.',
        paths: {
            '@story/core': ['../../core/src/index.ts'],
            '@story/shared': ['../../shared/src/index.ts'],
            '@story/ui': ['../../ui/src/index.ts'],
        },
    },
    include: ['data', 'types'],
});

const PARSE_HOST: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
};

const compilerOptionsOf = (dir: string): ts.CompilerOptions => {
    const parsed = ts.getParsedCommandLineOfConfigFile(path.join(dir, 'tsconfig.json'), {}, PARSE_HOST);
    if (parsed === undefined) throw new Error(`no tsconfig in ${dir}`);
    return parsed.options;
};

const HOST_SPECIFIERS = ['react', 'react/jsx-runtime', '@mui/icons-material', '@mui/icons-material/Bolt'];

let root: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
    ({ root, cleanup } = await makeTempStoriesRoot());
});
afterEach(() => cleanup());

describe('story tsconfig migration', () => {
    it('rewrites a stale tsconfig to the generated one, then is a no-op', async () => {
        const dir = await writeStoryFolder(root, 'alpha', { tsconfig: STALE_TSCONFIG });
        const file = path.join(dir, 'tsconfig.json');

        expect(await migrateStoryTsconfig(dir)).toBe(true);
        const generated = await storyTsconfig(dir);
        expect(await readFile(file, 'utf8')).toBe(generated);
        expect(generated).toContain('clients/shared/core/src/index.ts');

        expect(await migrateStoryTsconfig(dir)).toBe(false);
        await writeFile(file, generated);
        expect(await migrateStoryTsconfig(dir)).toBe(false);
    });

    it('leaves the committed example tsconfig alone: its comments do not count as a difference', async () => {
        expect(await migrateStoryTsconfig(EXAMPLE_STORY_ROOT)).toBe(false);
    });

    it('resolves React and MUI types for a story outside the repo', async () => {
        const dir = await writeStoryFolder(root, 'alpha', { tsconfig: STALE_TSCONFIG });
        await migrateStoryTsconfig(dir);
        const options = compilerOptionsOf(dir);
        const importer = path.join(dir, 'data', 'engine', 'Topbar.tsx');

        for (const specifier of HOST_SPECIFIERS) {
            const { resolvedModule } = ts.resolveModuleName(specifier, importer, options, ts.sys);
            expect(resolvedModule?.resolvedFileName, specifier).toMatch(/node_modules\/.+\.d\.ts$/);
        }
    });

    it('does not create a tsconfig for a folder without one', async () => {
        expect(await migrateStoryTsconfig(path.join(root, 'missing'))).toBe(false);
    });
});
