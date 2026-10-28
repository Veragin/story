export type TTimeRange = { start: string; end: string };

export type TTimeRangeEnd = keyof TTimeRange;

export const TIME_RANGE_ENDS = [
    { key: 'start', label: () => _('Start') },
    { key: 'end', label: () => _('End') },
] as const;
