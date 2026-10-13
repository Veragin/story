import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { THealthDto } from '@story/protocol';
import { DataSource } from 'typeorm';
import type { TEnv } from '../config/env';
import { STORY_CONTEXTS_OPTIONS, type TStoryContextsOptions } from '../storyContext/storyContextsOptions';

@Injectable()
export class HealthService {
    constructor(
        private readonly config: ConfigService<TEnv, true>,
        private readonly dataSource: DataSource,
        @Inject(STORY_CONTEXTS_OPTIONS) private readonly contexts: TStoryContextsOptions
    ) {}

    async check(): Promise<THealthDto> {
        await this.pingDatabase();
        return {
            ok: true,
            service: '@story/server',
            storiesRoot: this.config.get('STORIES_ROOT', { infer: true }),
            watching: this.contexts.watch,
            database: 'up',
        };
    }

    private async pingDatabase(): Promise<void> {
        try {
            await this.dataSource.query('SELECT 1');
        } catch {
            throw new ServiceUnavailableException('Database unreachable');
        }
    }
}
