import type { TImageErrorKind } from '../../../aiLauncher/gemini/ImageGenerationError';
import { HttpError } from '../../common/HttpError';
import { isPlainObject } from '../../common/isPlainObject';

export const IMAGE_TOO_SLOW_MESSAGE = 'Generating took too long';

const IMAGE_UNAVAILABLE_MESSAGE = 'Image generation is unavailable';

const imageFailed = (message: string) => HttpError.of('ai_image_failed', message);

const imageUnavailable = (detail: string | undefined) =>
    HttpError.of('ai_unavailable', detail ? `${IMAGE_UNAVAILABLE_MESSAGE}: ${detail}` : IMAGE_UNAVAILABLE_MESSAGE);

export const imageTooSlow = () => imageFailed(IMAGE_TOO_SLOW_MESSAGE);

export const imageGenerationError = (kind: TImageErrorKind, message: string): HttpError => {
    switch (kind) {
        case 'image_failed':
            return imageFailed(message);
        case 'unavailable':
            return imageUnavailable(message);
        case 'aborted':
            return imageTooSlow();
    }
};

const messageOf = (body: unknown): string | undefined =>
    isPlainObject(body) && typeof body.message === 'string' ? body.message : undefined;

export const launcherImageError = (status: number, body: unknown): HttpError => {
    const message = messageOf(body);
    switch (status) {
        case 422:
            return imageFailed(message ?? 'Gemini returned no image');
        case 401:
        case 503:
            return imageUnavailable(message);
        case 429:
            return HttpError.tooManyRequests('Too many images are being generated, try again in a minute');
        case 504:
            return imageTooSlow();
        default:
            return imageFailed(`The AI launcher answered ${status}${message ? `: ${message}` : ''}`);
    }
};
