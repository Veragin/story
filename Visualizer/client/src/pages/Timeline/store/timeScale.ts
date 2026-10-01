import { DAY_S, HOUR_S, MIN_S, MONTH_S, START_YEAR, Time, YEAR_S, type TTimeRenderFormat } from '@story/shared';
import { isCode, type TMaybeCode, type TTimeRangeDto, type TTimeString } from '@story/visualizer-protocol';

export const DEFAULT_PX_PER_SECOND = 1200 / (7 * DAY_S);
const MIN_PX_PER_SECOND = 1200 / (2 * YEAR_S);
const MAX_PX_PER_SECOND = 1200 / (6 * HOUR_S);

export const clampPxPerSecond = (pps: number) => Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, pps));

export const timeToX = (seconds: number, pps: number) => seconds * pps;
export const xToTime = (x: number, pps: number) => x / pps;

const SNAP_STEPS = [5 * MIN_S, 15 * MIN_S, HOUR_S, 6 * HOUR_S, DAY_S];

export const snapStep = (pps: number) => SNAP_STEPS.find((s) => s * pps >= 3) ?? DAY_S;

export const snapTime = (seconds: number, pps: number) => {
    const step = snapStep(pps);
    return Math.round(seconds / step) * step;
};

const LABEL_SPACING_PX = 120;

const LABEL_STEPS: { step: number; format: TTimeRenderFormat }[] = [
    { step: HOUR_S, format: 'dateTime' },
    { step: 4 * HOUR_S, format: 'dateTime' },
    { step: 12 * HOUR_S, format: 'dateTime' },
    { step: DAY_S, format: 'date' },
    { step: 5 * DAY_S, format: 'date' },
    { step: MONTH_S, format: 'month' },
    { step: 2 * MONTH_S, format: 'month' },
    { step: 6 * MONTH_S, format: 'month' },
    { step: YEAR_S, format: 'month' },
];

export const labelStep = (pps: number) =>
    LABEL_STEPS.find((s) => s.step * pps >= LABEL_SPACING_PX) ?? LABEL_STEPS[LABEL_STEPS.length - 1];

export const parseTime = (value: TMaybeCode<TTimeString> | undefined): number | null => {
    if (value === undefined || isCode(value) || typeof value !== 'string') return null;
    try {
        const s = Time.fromString(value as Parameters<typeof Time.fromString>[0]).s;
        return Number.isFinite(s) ? s : null;
    } catch {
        return null;
    }
};

export const parseRange = (range: TMaybeCode<TTimeRangeDto>): { start: number; end: number } | null => {
    if (isCode(range)) return null;
    const start = parseTime(range.start);
    const end = parseTime(range.end);
    if (start === null || end === null) return null;
    return { start, end: Math.max(start, end) };
};

// the inverse of `Time.fromString`, minus seconds: drags snap to 5 minutes or more
export const formatTime = (seconds: number): TTimeString => {
    const s = Math.max(0, Math.round(seconds));
    const year = Math.floor(s / YEAR_S);
    let rest = s - year * YEAR_S;
    const month = Math.floor(rest / MONTH_S);
    rest -= month * MONTH_S;
    const day = Math.floor(rest / DAY_S);
    rest -= day * DAY_S;
    const hour = Math.floor(rest / HOUR_S);
    rest -= hour * HOUR_S;
    const min = Math.floor(rest / MIN_S);
    const date = year === 0 ? `${day + 1}.${month + 1}.` : `${day + 1}.${month + 1}.${year + START_YEAR}`;
    return `${date} ${hour}:${String(min).padStart(2, '0')}`;
};
