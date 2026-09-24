import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { PathNotAllowedError } from '../story/SourceFileService';
import { WriteConflict, WriterRefusal } from '../writer/TsWriterService';

/**
 * Turns every thrown error into `{ success: false, error }` (VISUALIZER_PLAN §5.3: "all `4xx`
 * with `{ success: false, error }`").
 *
 * One envelope for every failure, including the ones Nest raises itself (validation, 404s from
 * unmatched routes), so the client has exactly one shape to handle rather than one for Nest's
 * default body and one for ours.
 *
 * Two behaviours worth stating:
 *
 *  - **`PathNotAllowedError` becomes a `400`, never a `500`.** It means the *request* named a
 *    path outside `data/` and `types/` — a client bug or an attack, either way the caller's
 *    fault. Letting it fall through as a 500 would also leak the resolved path in a stack trace.
 *  - **Non-HTTP errors are logged with their stack and answered with a generic message.** A
 *    `ts-morph` failure or an `EACCES` is a server fault; the author needs it in the log, and
 *    the response does not need the filesystem layout.
 */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
    private readonly logger = new Logger('Api');

    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();

        if (exception instanceof PathNotAllowedError) {
            this.logger.warn(exception.message);
            response.status(400).json({ success: false, error: exception.message });
            return;
        }

        /**
         * `409 Conflict` — the file changed on disk since the client read it (§5.3's
         * optimistic concurrency). The response carries both hashes so the client can tell
         * "someone else edited this" from "my hash was stale", and refetch.
         */
        if (exception instanceof WriteConflict) {
            this.logger.warn(exception.message);
            response.status(409).json({
                success: false,
                error: exception.message,
                file: exception.file,
                expectedHash: exception.expected,
                actualHash: exception.actual,
            });
            return;
        }

        /**
         * `422 Unprocessable Content` — the request was well-formed but the *source file* is not
         * a shape the writer will edit (§4.5 rule 2). Distinct from a 400 on purpose: nothing
         * about the request needs fixing, and the message names the file so the author can open
         * it and edit it by hand.
         */
        if (exception instanceof WriterRefusal) {
            this.logger.warn(`Refused: ${exception.message}`);
            response.status(422).json({ success: false, error: exception.message, file: exception.file });
            return;
        }

        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            response.status(status).json({ success: false, error: messageOf(exception) });
            return;
        }

        const error = exception instanceof Error ? exception : new Error(String(exception));
        this.logger.error(error.message, error.stack);
        response.status(500).json({ success: false, error: 'Internal server error' });
    }
}

/**
 * Nest's exception bodies are inconsistent: a `NotFoundException('x')` carries a string, a
 * `ValidationPipe` failure carries `{ message: string[] }`, and a bare `BadRequestException()`
 * carries an object with `message` and `error`. All three become one string here.
 */
const messageOf = (exception: HttpException): string => {
    const body = exception.getResponse();
    if (typeof body === 'string') return body;

    const record = body as { message?: string | string[]; error?: string };
    if (Array.isArray(record.message)) return record.message.join('; ');
    if (typeof record.message === 'string') return record.message;
    return record.error ?? exception.message;
};
