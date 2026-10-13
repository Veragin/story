export const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
};

export const jsonText = (body: unknown): string => `${JSON.stringify(body)}\n`;
