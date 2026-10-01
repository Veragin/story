// Each story binds `@story/types` / `@story/data` to its own folders, so each needs its own
// `tsc -p stories/<id>/tsconfig.json`; the root program can only check the example.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
);
const storiesRoot = path.join(repoRoot, 'stories');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

const stories = existsSync(storiesRoot)
    ? readdirSync(storiesRoot, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
          .map((e) => e.name)
          .sort()
    : [];

const folders = [
    ...stories.map((id) => `stories/${id}`),
    'Visualizer/server/template',
];

const failed = [];
for (const folder of folders) {
    const tsconfig = path.join(repoRoot, folder, 'tsconfig.json');
    if (!existsSync(tsconfig)) {
        console.warn(
            `typecheck-stories: skipping ${folder} (no tsconfig.json)`
        );
        continue;
    }
    const { status } = spawnSync(
        process.execPath,
        [tsc, '--noEmit', '-p', tsconfig],
        {
            cwd: repoRoot,
            stdio: 'inherit',
        }
    );
    if (status !== 0) failed.push(folder);
}

if (failed.length > 0) {
    console.error(`typecheck-stories: type errors in ${failed.join(', ')}`);
    process.exit(1);
}
