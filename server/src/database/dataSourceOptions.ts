import type { DataSourceOptions } from 'typeorm';
import type { TEnv } from '../config/env';
import { MIGRATIONS } from './migrationRegistry';

export type TDatabaseEnv = Pick<TEnv, 'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME'>;

export const dataSourceOptions = (env: TDatabaseEnv): DataSourceOptions => ({
    type: 'mysql',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    entities: [],
    migrations: MIGRATIONS,
    synchronize: false,
});
