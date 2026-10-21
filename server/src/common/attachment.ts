import type { Response } from 'express';

export const sendAttachment = (res: Response, fileName: string, contentType: string, bytes: Uint8Array) => {
    res.writeHead(200, {
        'content-type': contentType,
        'content-disposition': `attachment; filename="${fileName}"`,
        'content-length': bytes.byteLength,
        'cache-control': 'no-store',
    });
    res.end(bytes);
};
