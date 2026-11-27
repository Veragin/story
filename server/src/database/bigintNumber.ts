import type { ValueTransformer } from 'typeorm';

// mysql2 reads BIGINT as a string; these columns stay far below Number.MAX_SAFE_INTEGER
export const BIGINT_NUMBER: ValueTransformer = {
    to: (value: unknown) => value,
    from: (value: unknown) => Number(value),
};
