import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { readAgentsConfig, type TGeminiConfig } from '../../aiLauncher/agentsConfig';
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
    gemini: TGeminiConfig;
    // AI_SANDBOX=none only: the dev's own key, used in-process
    localGeminiKey: string | null;
};

const LOGGER = new Logger('Ai');

export const aiOptionsFromConfig = (
    config: ConfigService<TEnv, true>,
    log: (message: string) => void = (message) => LOGGER.warn(message)
): TAiOptions => {
    const agents = readAgentsConfig(
        config.get('AI_AGENTS_CONFIG_FILE', { infer: true }),
        {
            AI_MODEL: config.get('AI_MODEL', { infer: true }),
            AI_MAX_BUDGET_USD: config.get('AI_MAX_BUDGET_USD', { infer: true }),
        },
        log
    );
    return {
        sandbox: config.get('AI_SANDBOX', { infer: true }),
        launcherUrl: config.get('AI_LAUNCHER_URL', { infer: true }),
        launcherKeyFile: config.get('AI_LAUNCHER_KEY_FILE', { infer: true }),
        sessionsDir: config.get('AI_SESSIONS_DIR', { infer: true }),
        model: agents.claude.defaultModel,
        idleStopMs: config.get('AI_IDLE_STOP_MS', { infer: true }),
        maxTurnMs: config.get('AI_MAX_TURN_MS', { infer: true }),
        maxBudgetUsd: agents.claude.maxBudgetUsd,
        messagesPerMinute: config.get('AI_MESSAGES_PER_MINUTE', { infer: true }),
        // a subscription token must not serve other users (plan 0.4)
        requireApiKey: config.get('COOKIE_SECURE', { infer: true }),
        gemini: agents.gemini,
        localGeminiKey: config.get('GEMINI_API_KEY', { infer: true }),
    };
};
