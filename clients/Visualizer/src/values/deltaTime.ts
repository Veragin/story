import type { TDeltaTimeDto } from '@story/protocol';

export const DEFAULT_DELTA_TIME: TDeltaTimeDto = { seconds: 600 };

const DELTA_RE = /^DeltaTime\.from(Min|S|Hour)\(\s*(\d+(?:\.\d+)?)\s*\)$/;

export const parseDelta = (code: string): TDeltaTimeDto | undefined => {
    const m = DELTA_RE.exec(code.trim());
    if (!m) return undefined;
    const factor = m[1] === 'Min' ? 60 : m[1] === 'Hour' ? 3600 : 1;
    return { seconds: Number(m[2]) * factor };
};
