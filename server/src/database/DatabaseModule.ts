import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TEnv } from '../config/env';
import { dataSourceOptions } from './dataSourceOptions';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService<TEnv, true>) =>
                dataSourceOptions({
                    DB_HOST: config.get('DB_HOST', { infer: true }),
                    DB_PORT: config.get('DB_PORT', { infer: true }),
                    DB_USER: config.get('DB_USER', { infer: true }),
                    DB_PASSWORD: config.get('DB_PASSWORD', { infer: true }),
                    DB_NAME: config.get('DB_NAME', { infer: true }),
                }),
        }),
    ],
})
export class DatabaseModule {}
