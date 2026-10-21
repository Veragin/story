import type { TVersion } from '@story/protocol';
import type { Request, Response } from 'express';

export type TVersionedFile = { bytes: Uint8Array; version: TVersion; contentType: string };

export const sendVersionedFile = (req: Request, res: Response, { bytes, version, contentType }: TVersionedFile) => {
    const etag = `"${version}"`;
    const headers = { etag, 'cache-control': 'no-cache' };
    if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        res.end();
    } else {
        res.writeHead(200, { ...headers, 'content-type': contentType, 'content-length': bytes.length });
        res.end(bytes);
    }
};
