import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TGeminiConfig } from './agentsConfig';
import type { TGeminiClient } from './gemini/geminiClient';
import { generateImage } from './gemini/generateImage';
import { ImageGenerationError, type TImageErrorKind } from './gemini/ImageGenerationError';
import { sendJson, type TLauncherErrorBody } from './httpReplies';
import { readJsonBody } from './jsonBody';
import { MAX_IMAGE_REQUEST_BYTES, parseImageRequest, type TImageRequest } from './imageRequest';

export type TImagesDeps = {
    client: TGeminiClient | null;
    config: TGeminiConfig;
    log: (message: string) => void;
};

const ERROR_REPLIES: Readonly<Record<TImageErrorKind, readonly [number, TLauncherErrorBody['error']]>> = {
    image_failed: [422, 'image_failed'],
    unavailable: [503, 'gemini_unavailable'],
    aborted: [504, 'timeout'],
};

const describeRequest = (request: TImageRequest) =>
    `image for ${request.storyId} (${request.model}, ${request.references.length} reference(s))`;

export const createImagesRoute = ({ client, config, log }: TImagesDeps) => {
    let inFlight = 0;

    const generate = async (res: ServerResponse, gemini: TGeminiClient, request: TImageRequest) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        const started = Date.now();
        try {
            const image = await generateImage(gemini, request, controller.signal);
            log(`${describeRequest(request)} generated in ${Date.now() - started} ms`);
            sendJson(res, 200, image);
        } catch (e) {
            if (!(e instanceof ImageGenerationError)) throw e;
            log(`${describeRequest(request)} failed (${e.kind}): ${e.message}`);
            const [status, error] = ERROR_REPLIES[e.kind];
            const message = e.kind === 'aborted' ? `Gemini took longer than ${config.timeoutMs} ms` : e.message;
            sendJson(res, status, { error, message });
        } finally {
            clearTimeout(timer);
        }
    };

    const handle = async (req: IncomingMessage, res: ServerResponse, gemini: TGeminiClient) => {
        const body = await readJsonBody(req, MAX_IMAGE_REQUEST_BYTES);
        if (!body.ok) return sendJson(res, body.status, body.body);
        const parsed = parseImageRequest(body.value, config);
        if (!parsed.ok) return sendJson(res, 400, { error: 'bad_request', message: parsed.message });
        await generate(res, gemini, parsed.request);
    };

    return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (!client) return sendJson(res, 503, { error: 'gemini_unavailable', message: 'No Gemini key configured' });
        if (inFlight >= config.maxConcurrent) return sendJson(res, 429, { error: 'too_many_requests' });
        inFlight++;
        try {
            await handle(req, res, client);
        } finally {
            inFlight--;
        }
    };
};
