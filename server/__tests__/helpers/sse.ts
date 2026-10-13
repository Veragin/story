import http from 'node:http';
import { SSE_EVENT, type TChangeEvent } from '@story/protocol';
import { waitFor, type TAny } from './http';

export type TSseFrame = { event: string; data: unknown };

// resolves once the `hello` frame arrived (or right away on a non-200 answer)
export const openEventStream = async (url: string, headers: http.OutgoingHttpHeaders = {}) => {
    const frames: TSseFrame[] = [];
    const changes: TChangeEvent[] = [];
    const req = http.get(url, { headers });
    const response = await new Promise<http.IncomingMessage>((resolve) => req.on('response', resolve));
    let buffer = '';
    response.setEncoding('utf8');
    response.on('data', (chunk: string) => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const event = /^event: (.*)$/m.exec(frame)?.[1];
            const data = /^data: (.*)$/m.exec(frame)?.[1];
            if (!event || !data) continue;
            const parsed: TAny = JSON.parse(data);
            frames.push({ event, data: parsed });
            if (event === SSE_EVENT.change) changes.push(parsed);
        }
    });
    if (response.statusCode === 200) await waitFor(() => frames.length > 0);
    return { response, frames, changes, close: () => req.destroy() };
};
