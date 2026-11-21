import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';

export type TGeminiPart = {
    text?: string;
    thought?: boolean;
    inlineData?: { mimeType?: string; data?: string };
};

export type TGeminiResponse = {
    candidates?: {
        content?: { parts?: TGeminiPart[] };
        finishReason?: string;
        finishMessage?: string;
    }[];
    promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

export type TGeminiClient = {
    models: { generateContent: (params: GenerateContentParameters) => Promise<TGeminiResponse> };
};

export const createGeminiClient = (apiKey: string): TGeminiClient => new GoogleGenAI({ apiKey, vertexai: false });
