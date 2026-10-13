import type { MigrationInterface } from 'typeorm';
import { Init1791914816945 } from './migrations/1791914816945-Init';
import { CreateStory1791916173791 } from './migrations/1791916173791-CreateStory';
import { CreateSession1791918196110 } from './migrations/1791918196110-CreateSession';

// explicit classes, not a glob: TypeORM loads globs with native import(), which bypasses Vitest's transform
export const MIGRATIONS: (new () => MigrationInterface)[] = [
    Init1791914816945,
    CreateStory1791916173791,
    CreateSession1791918196110,
];
