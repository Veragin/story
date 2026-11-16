import { once } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import type { Writable } from 'node:stream';

const LINE_BREAK = /\r?\n/;

export async function* ndjsonLines(input: AsyncIterable<Buffer | string>): AsyncGenerator<string> {
    const decoder = new StringDecoder('utf8');
    let pending = '';
    for await (const chunk of input) {
        const lines = (pending + (typeof chunk === 'string' ? chunk : decoder.write(chunk))).split(LINE_BREAK);
        pending = lines.pop() ?? '';
        yield* lines.filter(Boolean);
    }
    const rest = pending + decoder.end();
    if (rest) yield rest;
}

export const writeLine = async (output: Writable, line: string): Promise<void> => {
    if (!output.writable) return;
    if (output.write(`${line}\n`)) return;
    const abort = new AbortController();
    try {
        await Promise.race([
            once(output, 'drain', { signal: abort.signal }),
            once(output, 'close', { signal: abort.signal }),
        ]);
    } catch {
        return;
    } finally {
        abort.abort();
    }
};
