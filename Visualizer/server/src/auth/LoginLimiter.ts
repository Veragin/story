import type { IncomingMessage } from 'node:http';

/** At most this many failed logins per IP + story … */
export const MAX_FAILED_LOGINS = 10;
/** … within this window. */
export const LOGIN_WINDOW_MS = 10 * 60_000;

export type TLoginLimiterOptions = {
    maxFailures?: number;
    windowMs?: number;
};

/**
 * Brute-force protection for `POST /api/stories/:storyId/login` (multiple stories, phase 4). It
 * counts failed logins per `<ip> + <storyId>` in a fixed window that starts at the first failure.
 * Once `maxFailures` is reached, every attempt for that key (a right password included) is refused
 * with `429` until the window ends. A successful login clears the key.
 *
 * The IP is the socket's peer (`clientAddress`). Behind a proxy (the Vite dev proxy, a reverse
 * proxy in production) every client shares the proxy's address, so the limit is per story for all
 * of them together — unless `TRUST_PROXY=1` lets the proxy's `X-Forwarded-For` name the client.
 */
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

    /** Whether `key` has used up its failures for the current window. */
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

    /** Forget windows that ended (also done by a timer, once per window). */
    prune(now = Date.now()): void {
        for (const [key, entry] of this.failures) if (entry.resetAt <= now) this.failures.delete(key);
    }

    /** Stop the prune timer. */
    close(): void {
        clearInterval(this.pruneTimer);
    }
}

/** The limiter key of a login attempt. */
export const loginKey = (ip: string | undefined, storyId: string) => `${ip ?? 'unknown'}|${storyId}`;

/** `TRUST_PROXY=1`: take the client's address from `X-Forwarded-For` (see `clientAddress`). Off by default. */
export const trustProxyFromEnv = (env: NodeJS.ProcessEnv = process.env) => env.TRUST_PROXY?.trim() === '1';

/**
 * The address a login attempt is counted against.
 *
 * Without `trustProxy` it is the socket's peer. With it, it is the **last** (rightmost) hop of
 * `X-Forwarded-For`: the address the reverse proxy in front of this server saw the request come
 * from. Every hop to its left arrived *in* the request, so a client can put anything there — keying
 * on the first hop would let an attacker pick a fresh key per attempt and never be limited. The
 * last hop is the one entry the proxy wrote itself. (The production Caddy — `docker/Caddyfile` —
 * trusts no upstream proxy, so it replaces any incoming `X-Forwarded-For` with the peer's address
 * and the header holds exactly one hop; taking the last keeps it right for proxies that append.)
 *
 * Only turn it on when the server is reachable through that proxy alone (in
 * `docker-compose.prod.yml` its port is not published): a client that can reach the server
 * directly can send any `X-Forwarded-For`. Without the header it falls back to the socket's peer.
 */
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
