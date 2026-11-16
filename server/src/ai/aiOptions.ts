import type { ConfigService } from '@nestjs/config';
import type { AI_SANDBOXES, TEnv } from '../config/env';

export const AI_OPTIONS = Symbol('AI_OPTIONS');

export type TAiSandbox = (typeof AI_SANDBOXES)[number];

export type TAiOptions = {
    sandbox: TAiSandbox;
    launcherUrl: string;
    launcherKeyFile: string;
    sessionsDir: string;
    model: string;
    idleStopMs: number;
    maxTurnMs: number;
    maxBudgetUsd: number;
    messagesPerMinute: number;
    requireApiKey: boolean;
};

export const aiOptionsFromConfig = (config: ConfigService<TEnv, true>): TAiOptions => ({
    sandbox: config.get('AI_SANDBOX', { infer: true }),
    launcherUrl: config.get('AI_LAUNCHER_URL', { infer: true }),
    launcherKeyFile: config.get('AI_LAUNCHER_KEY_FILE', { infer: true }),
    sessionsDir: config.get('AI_SESSIONS_DIR', { infer: true }),
    model: config.get('AI_MODEL', { infer: true }),
    idleStopMs: config.get('AI_IDLE_STOP_MS', { infer: true }),
    maxTurnMs: config.get('AI_MAX_TURN_MS', { infer: true }),
    maxBudgetUsd: config.get('AI_MAX_BUDGET_USD', { infer: true }),
    messagesPerMinute: config.get('AI_MESSAGES_PER_MINUTE', { infer: true }),
    // a subscription token must not serve other users (plan 0.4)
    requireApiKey: config.get('COOKIE_SECURE', { infer: true }),
});
