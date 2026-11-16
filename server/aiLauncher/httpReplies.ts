import { STATUS_CODES, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

export type TLauncherErrorCode =
    | 'unauthorized'
    | 'not_found'
    | 'method_not_allowed'
    | 'upgrade_required'
    | 'bad_request'
    | 'payload_too_large'
    | 'token_unavailable'
    | 'spawn_failed'
    | 'internal_error';

export type TLauncherErrorBody = { error: TLauncherErrorCode; message?: string };

const AUTH_CHALLENGE = { 'WWW-Authenticate': 'Bearer' };

const extraHeaders = (status: number): Record<string, string> => (status === 401 ? AUTH_CHALLENGE : {});

export const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...extraHeaders(status),
    });
    res.end(payload);
};

export const rejectUpgrade = (socket: Duplex, status: number, body: TLauncherErrorBody): void => {
    if (socket.destroyed) return;
    const payload = JSON.stringify(body);
    const headers = {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(payload)),
        'Connection': 'close',
        ...extraHeaders(status),
    };
    const head = Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`);
    socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\n${head.join('')}\r\n${payload}`);
};

export const acceptUpgrade = (socket: Duplex, protocol: string): void => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: ${protocol}\r\n\r\n`);
};
