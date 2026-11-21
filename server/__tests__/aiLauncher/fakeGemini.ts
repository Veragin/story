import type { GenerateContentParameters } from '@google/genai';
import { PNG_SIGNATURE, RIFF_SIGNATURE, WEBP_SIGNATURE } from '@story/protocol';
import { DEFAULT_AGENTS_CONFIG, type TGeminiConfig } from '../../aiLauncher/agentsConfig';
import type { TGeminiClient, TGeminiResponse } from '../../aiLauncher/gemini/geminiClient';

export const TEST_IMAGE_MODEL = 'gemini-test-image';

export const TEST_GEMINI_CONFIG: TGeminiConfig = {
    ...DEFAULT_AGENTS_CONFIG.gemini,
    imageModels: { [TEST_IMAGE_MODEL]: { creditsPerImage: 4, maxReferences: 2 } },
    defaultImageModel: TEST_IMAGE_MODEL,
};

export const PNG_BASE64 = Buffer.from([...PNG_SIGNATURE, 0, 0, 0, 13]).toString('base64');
export const WEBP_BASE64 = Buffer.from([...RIFF_SIGNATURE, 4, 0, 0, 0, ...WEBP_SIGNATURE, 1, 2]).toString('base64');

export const IMAGE_RESPONSE: TGeminiResponse = {
    candidates: [
        {
            content: { parts: [{ text: 'Here you go' }, { inlineData: { mimeType: 'image/png', data: PNG_BASE64 } }] },
            finishReason: 'STOP',
        },
    ],
    usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 1290, totalTokenCount: 1590 },
};

export const untilAborted = (params: GenerateContentParameters): Promise<never> =>
    new Promise((_, reject) => {
        const signal = params.config?.abortSignal;
        signal?.addEventListener('abort', () => reject(new Error('This operation was aborted')), { once: true });
    });

export class FakeGemini implements TGeminiClient {
    readonly calls: GenerateContentParameters[] = [];
    respond: (params: GenerateContentParameters) => Promise<TGeminiResponse> = () => Promise.resolve(IMAGE_RESPONSE);

    answerWith(response: TGeminiResponse): void {
        this.respond = () => Promise.resolve(response);
    }

    failWith(error: Error): void {
        this.respond = () => Promise.reject(error);
    }

    readonly models = {
        generateContent: async (params: GenerateContentParameters): Promise<TGeminiResponse> => {
            this.calls.push(params);
            return await this.respond(params);
        },
    };
}
