import type { Duplex } from 'node:stream';

export const readUpgradeBody = (socket: Duplex, head: Buffer, length: number, timeoutMs: number): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        let received = head;
        const cleanup = () => {
            clearTimeout(timer);
            socket.off('data', onData);
            socket.off('end', onEnd);
            socket.pause();
        };
        const settle = () => {
            if (received.length < length) return;
            cleanup();
            const rest = received.subarray(length);
            if (rest.length > 0) socket.unshift(rest);
            resolve(received.subarray(0, length));
        };
        const onData = (chunk: Buffer) => {
            received = Buffer.concat([received, chunk]);
            settle();
        };
        const onEnd = () => {
            cleanup();
            reject(new Error('Connection closed before the request body was complete'));
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Timed out reading the request body'));
        }, timeoutMs);
        socket.on('data', onData);
        socket.once('end', onEnd);
        settle();
    });
