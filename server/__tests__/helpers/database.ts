import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { parseEnv } from '../../src/config/env';
import { dataSourceOptions } from '../../src/database/dataSourceOptions';

const TEST_DATABASE = /_test$/;

export const testDatabaseEnv = () => {
    const env = parseEnv(process.env);
    // truncating is destructive: refuse anything but a *_test database
    if (!TEST_DATABASE.test(env.DB_NAME)) throw new Error(`Refusing to use "${env.DB_NAME}" as the test database`);
    return env;
};

export const createTestDataSource = (): DataSource => new DataSource(dataSourceOptions(testDatabaseEnv()));

export const truncateTables = async (dataSource: DataSource): Promise<void> => {
    const runner = dataSource.createQueryRunner();
    try {
        await runner.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const { tableName } of dataSource.entityMetadatas) await runner.query(`TRUNCATE TABLE \`${tableName}\``);
        await runner.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
        await runner.release();
    }
};

export const setupTestDatabase = (): DataSource => {
    const dataSource = createTestDataSource();
    beforeAll(async () => {
        await dataSource.initialize();
        await dataSource.runMigrations();
    });
    beforeEach(() => truncateTables(dataSource));
    afterAll(() => dataSource.destroy());
    return dataSource;
};
