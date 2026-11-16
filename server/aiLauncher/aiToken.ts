import { readSecretFile } from './secretFile';

export type TAiTokenKind = 'api_key' | 'oauth';

export type TAiToken = { kind: TAiTokenKind; value: string };

export const AI_TOKEN_ENV: Readonly<Record<TAiTokenKind, string>> = {
    api_key: 'ANTHROPIC_API_KEY',
    oauth: 'CLAUDE_CODE_OAUTH_TOKEN',
};

const TOKEN_PREFIXES: ReadonlyArray<readonly [string, TAiTokenKind]> = [
    ['sk-ant-api', 'api_key'],
    ['sk-ant-oat', 'oauth'],
];

export const classifyAiToken = (raw: string): TAiToken | null => {
    const value = raw.trim();
    const match = TOKEN_PREFIXES.find(([prefix]) => value.startsWith(prefix));
    return match && !/\s/.test(value) ? { kind: match[1], value } : null;
};

export const readAiToken = async (file: string): Promise<TAiToken | null> => {
    const raw = await readSecretFile(file);
    return raw === null ? null : classifyAiToken(raw);
};

export const tokenEnv = (token: TAiToken, base: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
    const inherited = Object.fromEntries(
        Object.entries(base).filter(([name]) => !Object.values(AI_TOKEN_ENV).includes(name))
    );
    return { ...inherited, [AI_TOKEN_ENV[token.kind]]: token.value };
};
