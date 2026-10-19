import type { NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

// bodies are read by JsonBodyInterceptor / multer, after the guards; open event streams must not block close()
export const EXPRESS_APP_OPTIONS: NestApplicationOptions = { bodyParser: false, forceCloseConnections: true };

export const configureExpressApp = (app: NestExpressApplication): void => {
    app.disable('x-powered-by');
    // JSON goes out as text (JsonResponseInterceptor); no ETag / 304 on it, as before
    app.set('etag', false);
};
