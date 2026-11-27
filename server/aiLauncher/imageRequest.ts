import {
    IMAGE_PROMPT_MAX_LENGTH,
    PNG_SIGNATURE,
    RIFF_SIGNATURE,
    STORY_ID_PATTERN,
    WEBP_SIGNATURE,
} from '@story/protocol';
import { z } from 'zod';
import type { TGeminiConfig } from './agentsConfig';

export const IMAGE_MIME_TYPES = ['image/webp', 'image/png'] as const;
export type TImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export type TImageReference = { label: string; mimeType: TImageMimeType; data: string };

export type TImageRequest = {
    storyId: string;
    model: string;
    prompt: string;
    references: TImageReference[];
};

export type TImageLimits = Pick<TGeminiConfig, 'imageModels'>;

export type TImageRequestResult = { ok: true; request: TImageRequest } | { ok: false; message: string };

export const MAX_REFERENCE_BYTES = 1024 * 1024;
export const MAX_IMAGE_REQUEST_BYTES = 8 * 1024 * 1024;

const MAX_LABEL_LENGTH = 200;
const MAX_REFERENCE_BASE64_LENGTH = Math.ceil(MAX_REFERENCE_BYTES / 3) * 4;

const SIGNATURES: Readonly<Record<TImageMimeType, readonly (readonly [number, readonly number[]])[]>> = {
    'image/png': [[0, PNG_SIGNATURE]],
    'image/webp': [
        [0, RIFF_SIGNATURE],
        [8, WEBP_SIGNATURE],
    ],
};

const hasSignature = (bytes: Buffer, mimeType: TImageMimeType) =>
    SIGNATURES[mimeType].every(([offset, signature]) => signature.every((byte, i) => bytes[offset + i] === byte));

const REFERENCE_SCHEMA = z
    .strictObject({
        label: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
        mimeType: z.enum(IMAGE_MIME_TYPES),
        data: z.base64().max(MAX_REFERENCE_BASE64_LENGTH, 'is over 1 MB'),
    })
    .superRefine((reference, ctx) => {
        const bytes = Buffer.from(reference.data, 'base64');
        if (bytes.length > MAX_REFERENCE_BYTES)
            ctx.addIssue({ code: 'custom', path: ['data'], message: 'is over 1 MB' });
        else if (!hasSignature(bytes, reference.mimeType))
            ctx.addIssue({ code: 'custom', path: ['data'], message: `is not a ${reference.mimeType} image` });
    });

const maxReferencesOf = (limits: TImageLimits, model: string): number | undefined =>
    Object.hasOwn(limits.imageModels, model) ? limits.imageModels[model]?.maxReferences : undefined;

const imageRequestSchema = (limits: TImageLimits) => {
    const models = Object.keys(limits.imageModels);
    const mostReferences = Math.max(0, ...Object.values(limits.imageModels).map((model) => model.maxReferences));
    return z
        .strictObject({
            storyId: z.string().regex(STORY_ID_PATTERN),
            model: z.string().refine((model) => models.includes(model), `must be one of ${models.join(', ')}`),
            prompt: z.string().trim().min(1).max(IMAGE_PROMPT_MAX_LENGTH),
            references: z.array(REFERENCE_SCHEMA).max(mostReferences),
        })
        .superRefine((request, ctx) => {
            const limit = maxReferencesOf(limits, request.model) ?? 0;
            if (request.references.length > limit)
                ctx.addIssue({
                    code: 'custom',
                    path: ['references'],
                    message: `${request.model} takes at most ${limit} reference image(s)`,
                });
        });
};

export const parseImageRequest = (body: unknown, limits: TImageLimits): TImageRequestResult => {
    const parsed = imageRequestSchema(limits).safeParse(body);
    return parsed.success ? { ok: true, request: parsed.data } : { ok: false, message: z.prettifyError(parsed.error) };
};
