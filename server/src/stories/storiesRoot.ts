import type { ConfigService } from '@nestjs/config';
import type { TEnv } from '../config/env';

export const STORIES_ROOT = Symbol('STORIES_ROOT');

export const storiesRootFromConfig = (config: ConfigService<TEnv, true>): string =>
    config.get('STORIES_ROOT', { infer: true });
