// Response bodies in tests are poked at freely; the DTO types are checked by the server code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TAny = any;

export type TJsonResponse = { status: number; headers: Headers; body: TAny };

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const EXAMPLE_PASSWORD = 'example';

// every mutation is sent as JSON: the CSRF check wants the content type
export const requestJson = async (
    url: string,
    method: string,
    { body, headers = {} }: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<TJsonResponse> => {
    const res = await fetch(url, {
        method,
        headers: { ...(method === 'GET' ? {} : { 'content-type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
};

export const cookieOf = (res: { headers: Headers }) => (res.headers.get('set-cookie') ?? '').split(';')[0];

export const login = async (
    base: string,
    storyId = 'example',
    { password = EXAMPLE_PASSWORD, cookie }: { password?: string; cookie?: string } = {}
): Promise<string> => {
    const res = await requestJson(`${base}/api/stories/${storyId}/login`, 'POST', {
        body: { password },
        headers: cookie ? { cookie } : {},
    });
    if (res.status !== 204) throw new Error(`login to ${storyId} answered ${res.status}`);
    return cookieOf(res);
};

// long enough for chokidar to report and a 50 ms batch to flush, with margin for a slow CI box
export const QUIET_MS = 700;

export const waitFor = async (predicate: () => boolean, timeoutMs = 5000) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) throw new Error('timed out');
        await sleep(20);
    }
};
