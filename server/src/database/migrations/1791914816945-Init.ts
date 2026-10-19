import type { MigrationInterface } from 'typeorm';

// baseline: proves the migration toolchain before the first table (Phase 4) exists
export class Init1791914816945 implements MigrationInterface {
    up(): Promise<void> {
        return Promise.resolve();
    }

    down(): Promise<void> {
        return Promise.resolve();
    }
}
