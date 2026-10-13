import type { MigrationInterface } from 'typeorm';
import { Init1791914816945 } from './migrations/1791914816945-Init';

// explicit classes, not a glob: TypeORM loads globs with native import(), which bypasses Vitest's transform
export const MIGRATIONS: (new () => MigrationInterface)[] = [Init1791914816945];
