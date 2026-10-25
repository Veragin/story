import 'reflect-metadata';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parseEnv } from '../src/config/env';
import { dataSource } from '../src/database/dataSource';
import { importStoryFiles } from '../src/stories/importStoryFiles';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { readStorySeed, storySeedFile, storySeedId } from '../src/stories/storySeed';

const { values } = parseArgs({ options: { seed: { type: 'string', multiple: true } } });
const { STORIES_ROOT } = parseEnv(process.env);
const seeds = await Promise.all((values.seed ?? []).map((dir) => readStorySeed(path.resolve(dir))));

await dataSource.initialize();
try {
    await dataSource.runMigrations();
    const report = await importStoryFiles(STORIES_ROOT, new StoryRepository(dataSource), { seeds });
    console.log(`[stories:import-files] root ${STORIES_ROOT}`);
    for (const seed of seeds.filter((s) => report.seeded.includes(storySeedId(s))))
        console.log(
            `[stories:import-files] seeded "${storySeedId(seed)}" from ${seed.dir} + ${storySeedFile(seed.dir)}`
        );
    for (const { id, result } of report.imported) console.log(`[stories:import-files] ${id}: ${result}`);
    for (const id of report.tsconfigRewritten) console.log(`[stories:import-files] ${id}: tsconfig.json rewritten`);
    for (const { id, reason } of report.skipped) console.warn(`[stories:import-files] skipped ${id}: ${reason}`);
    if (report.imported.length === 0 && report.skipped.length === 0 && report.seeded.length === 0)
        console.log('[stories:import-files] nothing to import');
} finally {
    await dataSource.destroy();
}
