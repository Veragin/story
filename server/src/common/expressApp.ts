import type { NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

// bodies are read by JsonBodyInterceptor / multer, after the guards; open event streams must not block close()
export const EXPRESS_APP_OPTIONS: NestApplicationOptions = { bodyParser: false, forceCloseConnections: true };

export const configureExpressApp = (app: NestExpressApplication): void => {
    app.disable('x-powered-by');
    // the play site is same-site: its story code must not embed this host's API as an <img> or <script>
    app.use((_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        next();
    });
    // JSON goes out as text (JsonResponseInterceptor); no ETag / 304 on it, as before
    app.set('etag', false);
};
