import 'reflect-metadata';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parseEnv } from '../src/config/env';
import { dataSource } from '../src/database/dataSource';
import { importStoryFiles } from '../src/stories/importStoryFiles';
import { StoryRepository } from '../src/database/repositories/StoryRepository';
import { readStorySeed, storySeedFile } from '../src/stories/storySeed';

const { values } = parseArgs({ options: { seed: { type: 'string' } } });
const { STORIES_ROOT } = parseEnv(process.env);
const seed = values.seed === undefined ? undefined : await readStorySeed(path.resolve(values.seed));

await dataSource.initialize();
try {
    await dataSource.runMigrations();
    const report = await importStoryFiles(STORIES_ROOT, new StoryRepository(dataSource), { seed });
    console.log(`[stories:import-files] root ${STORIES_ROOT}`);
    if (seed !== undefined && report.seeded !== null)
        console.log(`[stories:import-files] seeded "${report.seeded}" from ${seed.dir} + ${storySeedFile(seed.dir)}`);
    for (const { id, result } of report.imported) console.log(`[stories:import-files] ${id}: ${result}`);
    for (const id of report.tsconfigRewritten) console.log(`[stories:import-files] ${id}: tsconfig.json rewritten`);
    for (const { id, reason } of report.skipped) console.warn(`[stories:import-files] skipped ${id}: ${reason}`);
    if (report.imported.length === 0 && report.skipped.length === 0 && report.seeded === null)
        console.log('[stories:import-files] nothing to import');
} finally {
    await dataSource.destroy();
}
