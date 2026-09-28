/**
 * Type-check every story under `stories/` on its own (multiple stories, phase 2). Part of
 * `yarn typecheck`.
 *
 * Each story has its own type universe: `types/ids.ts` derives `TCharacterId`, `TChapterId`, …
 * from that story's `data/TWorldState.ts`, so `@story/types` / `@story/data` mean something
 * different in every story. The root `tsconfig.json` is one program with one binding for each
 * (the example, which is also the `@story/data` / `@story/types` workspace), so it cannot check
 * the others. Every story therefore carries a `stories/<id>/tsconfig.json` that points those two
 * names at its own folders and the engine packages at the repo, and this runs
 * `tsc --noEmit -p` over each of them.
 *
 * A folder without a `tsconfig.json` is skipped with a warning rather than failed: it is not a
 * story (yet), and a half-copied folder should not break every developer's typecheck. Folders
 * whose name starts with `.` are skipped silently: the Visualizer server builds a new or imported
 * story under such a temp name before renaming it into place.
 *
 * The story template the server copies on "create story" (`Visualizer/server/template/`, phase 5)
 * is checked the same way, through its own `tsconfig.json`: every new story starts as a copy of
 * it, so it must type-check on its own. Exits non-zero if any of them has a type error.
 */
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

/** Repo-relative folders to check: every story, then the template. */
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
