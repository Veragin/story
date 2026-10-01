import type { IncomingMessage } from 'node:http';

const MAX_FAILED_LOGINS = 10;
const LOGIN_WINDOW_MS = 10 * 60_000;

export type TLoginLimiterOptions = {
    maxFailures?: number;
    windowMs?: number;
};

export class LoginLimiter {
    private readonly maxFailures: number;
    private readonly windowMs: number;
    private readonly failures = new Map<string, { count: number; resetAt: number }>();
    private readonly pruneTimer: NodeJS.Timeout;

    constructor({ maxFailures = MAX_FAILED_LOGINS, windowMs = LOGIN_WINDOW_MS }: TLoginLimiterOptions = {}) {
        this.maxFailures = maxFailures;
        this.windowMs = windowMs;
        this.pruneTimer = setInterval(() => this.prune(), windowMs);
        this.pruneTimer.unref();
    }

    isBlocked(key: string, now = Date.now()): boolean {
        const entry = this.failures.get(key);
        if (!entry) return false;
        if (entry.resetAt <= now) {
            this.failures.delete(key);
            return false;
        }
        return entry.count >= this.maxFailures;
    }

    fail(key: string, now = Date.now()): void {
        const entry = this.failures.get(key);
        if (!entry || entry.resetAt <= now) {
            this.failures.set(key, { count: 1, resetAt: now + this.windowMs });
        } else {
            entry.count++;
        }
    }

    succeed(key: string): void {
        this.failures.delete(key);
    }

    prune(now = Date.now()): void {
        for (const [key, entry] of this.failures) if (entry.resetAt <= now) this.failures.delete(key);
    }

    close(): void {
        clearInterval(this.pruneTimer);
    }
}

export const loginKey = (ip: string | undefined, storyId: string) => `${ip ?? 'unknown'}|${storyId}`;

export const trustProxyFromEnv = (env: NodeJS.ProcessEnv = process.env) => env.TRUST_PROXY?.trim() === '1';

// rightmost X-Forwarded-For hop: the only one the proxy wrote, earlier hops are client-controlled
export const clientAddress = (req: IncomingMessage, trustProxy: boolean): string | undefined => {
    if (trustProxy) {
        const header = req.headers['x-forwarded-for'];
        const hops = (Array.isArray(header) ? header.join(',') : (header ?? ''))
            .split(',')
            .map((hop) => hop.trim())
            .filter(Boolean);
        if (hops.length > 0) return hops[hops.length - 1];
    }
    return req.socket.remoteAddress;
};
