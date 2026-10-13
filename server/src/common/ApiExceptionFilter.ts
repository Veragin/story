import {
    Catch,
    HttpException,
    Logger,
    NotFoundException,
    type ArgumentsHost,
    type ExceptionFilter,
} from '@nestjs/common';
import { ERROR_STATUS, type TApiErrorBody, type TApiErrorCode } from '@story/protocol';
import type { Request, Response } from 'express';
import { errorMessage, isHttpError } from './HttpError';

const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
};

const HTTP_EXCEPTION_CODES: Partial<Record<number, TApiErrorCode>> = {
    400: 'bad_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    413: 'bad_request',
    429: 'too_many_requests',
    501: 'not_implemented',
};

const isRouteMiss = (exception: HttpException, req: Request) =>
    exception instanceof NotFoundException && exception.message === `Cannot ${req.method} ${req.originalUrl}`;

const httpExceptionBody = (exception: HttpException, req: Request): TApiErrorBody => {
    const status = exception.getStatus();
    const error = HTTP_EXCEPTION_CODES[status] ?? (status < 500 ? 'bad_request' : 'internal');
    if (isRouteMiss(exception, req)) {
        return { error, message: `No route ${req.method} ${new URL(req.originalUrl, 'http://localhost').pathname}` };
    }
    return { error, message: exception.message };
};

const sendJson = (res: Response, status: number, body: TApiErrorBody) => {
    if (res.headersSent) {
        res.end();
        return;
    }
    res.writeHead(status, JSON_HEADERS);
    res.end(JSON.stringify(body) + '\n');
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ApiExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const res = http.getResponse<Response>();
        if (isHttpError(exception)) {
            sendJson(res, exception.status, exception.body);
            return;
        }
        if (exception instanceof HttpException) {
            const body = httpExceptionBody(exception, http.getRequest<Request>());
            sendJson(res, ERROR_STATUS[body.error], body);
            return;
        }
        this.logger.error('unhandled error', exception);
        sendJson(res, 500, { error: 'internal', message: errorMessage(exception) });
    }
}
