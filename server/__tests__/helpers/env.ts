import { parseEnv } from '../../src/config/env';

export const TEST_MAIL_FROM = 'test@story.local';

// MAIL_FROM is required: the Dockerfiles set it
export const parseTestEnv = (raw: Record<string, unknown> = {}) => parseEnv({ MAIL_FROM: TEST_MAIL_FROM, ...raw });
