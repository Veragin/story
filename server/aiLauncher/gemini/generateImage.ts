import type { TImageRequest } from '../imageRequest';
import type { TGeminiClient, TGeminiPart, TGeminiResponse } from './geminiClient';
import { ImageGenerationError } from './ImageGenerationError';

export type TImageUsage = { promptTokens: number; candidatesTokens: number; totalTokens: number };

export type TGeneratedImage = { mimeType: string; data: string; usage: TImageUsage };

export type TImageGeneration = Pick<TImageRequest, 'model' | 'prompt' | 'references'>;

export const IMAGE_ASPECT_RATIO = '1:1';

const MAX_MESSAGE_LENGTH = 500;
const BAD_REQUEST_STATUS = 400;
const QUOTA_STATUS = 429;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const scrubMessage = (text: string): string => {
    const clean = text
        .replace(/\p{Cc}+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return clean.length > MAX_MESSAGE_LENGTH ? `${clean.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : clean;
};

const parts = (response: TGeminiResponse): TGeminiPart[] =>
    (response.candidates ?? []).flatMap((candidate) => candidate.content?.parts ?? []);

const imageOf = (response: TGeminiResponse) => {
    for (const part of parts(response)) {
        const mimeType = part.inlineData?.mimeType;
        const data = part.inlineData?.data;
        if (!part.thought && mimeType && data) return { mimeType, data };
    }
    return null;
};

const usageOf = (response: TGeminiResponse): TImageUsage => ({
    promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
    candidatesTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
});

const noImageMessage = (response: TGeminiResponse): string => {
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason === 'STOP' ? undefined : candidate?.finishReason;
    const reason = response.promptFeedback?.blockReason ?? finishReason;
    const text = parts(response)
        .filter((part) => !part.thought && part.text)
        .map((part) => part.text)
        .join(' ');
    const detail = text.trim() || candidate?.finishMessage || response.promptFeedback?.blockReasonMessage;
    const message = `Gemini returned no image${reason ? ` (${reason})` : ''}${detail ? `: ${detail}` : ''}`;
    return scrubMessage(message);
};

const statusOf = (e: unknown): number | undefined =>
    isRecord(e) && typeof e.status === 'number' ? e.status : undefined;

const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const apiMessageOf = (e: Error): string => {
    const body = parseJson(e.message);
    return isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string'
        ? body.error.message
        : e.message;
};

const callError = (e: unknown, signal: AbortSignal): unknown => {
    if (signal.aborted) return new ImageGenerationError('aborted', 'The Gemini call was aborted');
    if (!(e instanceof Error)) return e;
    const status = statusOf(e);
    const message = scrubMessage(apiMessageOf(e));
    if (status === BAD_REQUEST_STATUS) return new ImageGenerationError('image_failed', `Gemini refused: ${message}`);
    if (status === QUOTA_STATUS || e.message.includes('RESOURCE_EXHAUSTED'))
        return new ImageGenerationError('unavailable', `Gemini quota exhausted: ${message}`);
    return new ImageGenerationError('unavailable', `Gemini is unavailable: ${message}`);
};

export const generateImage = async (
    client: TGeminiClient,
    request: TImageGeneration,
    signal: AbortSignal
): Promise<TGeneratedImage> => {
    const call = async () => {
        try {
            return await client.models.generateContent({
                model: request.model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: request.prompt },
                            ...request.references.map(({ mimeType, data }) => ({ inlineData: { mimeType, data } })),
                        ],
                    },
                ],
                config: {
                    responseModalities: ['IMAGE'],
                    imageConfig: { aspectRatio: IMAGE_ASPECT_RATIO },
                    abortSignal: signal,
                },
            });
        } catch (e) {
            throw callError(e, signal);
        }
    };
    const response = await call();
    const image = imageOf(response);
    if (!image) throw new ImageGenerationError('image_failed', noImageMessage(response));
    return { ...image, usage: usageOf(response) };
};
