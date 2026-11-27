import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { isStoryId } from '@story/protocol';
import { dataSource } from '../src/database/dataSource';
import { AiCreditRepository } from '../src/database/repositories/AiCreditRepository';
import { StoryRepository } from '../src/database/repositories/StoryRepository';

const USAGE = 'usage: ai:enable <storyId> [--credits N]';

const fail = (message: string): never => {
    console.error(`[ai:enable] ${message}\n${USAGE}`);
    process.exit(1);
};

const parseCredits = (value: string | undefined): number => {
    if (value === undefined) return 0;
    const credits = Number(value);
    return /^\d+$/.test(value) && Number.isSafeInteger(credits) ? credits : fail('--credits must be a whole number');
};

const parseStoryId = (positionals: string[]): string => {
    const [storyId] = positionals;
    return positionals.length === 1 && isStoryId(storyId) ? storyId : fail('give exactly one story id');
};

const { values, positionals } = parseArgs({ options: { credits: { type: 'string' } }, allowPositionals: true });
const storyId = parseStoryId(positionals);
const credits = parseCredits(values.credits);

await dataSource.initialize();
try {
    await dataSource.runMigrations();
    const stories = new StoryRepository(dataSource);
    const aiCredits = new AiCreditRepository(dataSource);
    if (await stories.exists(storyId)) {
        await stories.setAiFeature(storyId, true);
        const balance = credits > 0 ? await aiCredits.topUp(storyId, credits) : await aiCredits.balance(storyId);
        console.log(`[ai:enable] ${storyId}: aiFeature on, ${balance} credits`);
    } else {
        console.error(`[ai:enable] no story "${storyId}"`);
        process.exitCode = 1;
    }
} finally {
    await dataSource.destroy();
}
