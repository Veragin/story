import type { ServerResponse } from 'node:http';

// setTimeout overflows past ~24.8 days; grants last 24 h
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export const endAtExpiry = (res: ServerResponse, expiresAt: number): void => {
    const timer = setTimeout(() => res.end(), Math.min(Math.max(0, expiresAt - Date.now()), MAX_TIMEOUT_MS));
    timer.unref();
    res.on('close', () => clearTimeout(timer));
};
