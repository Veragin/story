import { Inject, Injectable } from '@nestjs/common';
import { IMAGE_PROMPT_MAX_LENGTH, type TGenerateImageResult, type TImageOwner } from '@story/protocol';
import { imageLinkPath } from '@story/shared';
import type { TGeminiConfig } from '../../../aiLauncher/agentsConfig';
import type { TImageGeneration, TImageUsage } from '../../../aiLauncher/gemini/generateImage';
import type { TImageReference } from '../../../aiLauncher/imageRequest';
import type { LoginLimiter } from '../../auth/LoginLimiter';
import { jsonObjectBody, versionField } from '../../common/body';
import { rejectUnknownFields, textField } from '../../common/fields';
import { HttpError } from '../../common/HttpError';
import { AiCreditRepository } from '../../database/repositories/AiCreditRepository';
import { StoryRepository } from '../../database/repositories/StoryRepository';
import { readImage, uploadImage } from '../../project/images';
import type { SourceProject } from '../../project/SourceProject';
import type { TServerContext } from '../../storyContext/serverContext';
import { AGENT_CONNECTION, type TAgentConnection } from '../agentConnection/TAgentConnection';
import { AiAgents } from '../AiAgents';
import { AiAvailability } from '../AiAvailability';
import { AI_OPTIONS, type TAiOptions } from '../aiOptions';
import { DISABLED_MESSAGE, NO_CREDITS_MESSAGE } from '../AiService';
import { microUsdOf, usdOfCredits } from '../usage';
import { AI_IMAGE_LIMITER } from './aiImageLimiter';
import { referenceWebp, storedWebp } from './imageBytes';
import { ImageJobs } from './ImageJobs';
import {
    buildImagePrompt,
    invalidPrompt,
    type TImageOwnerRef,
    type TPromptReference,
    uniqueMentions,
} from './imagePrompt';
import { readMentionTargets } from './mentionTargets';

const IMAGE_UNAVAILABLE_MESSAGE = 'The server cannot generate images right now';

type TImageModel = { model: string; credits: number; maxReferences: number };

type TSettled<T> = { ok: true; value: T } | { ok: false; error: unknown };

const settle = async <T>(task: Promise<T>): Promise<TSettled<T>> => {
    try {
        return { ok: true, value: await task };
    } catch (error) {
        return { ok: false, error };
    }
};

const imageModelOf = ({ defaultImageModel, imageModels }: TGeminiConfig): TImageModel => {
    const config = Object.hasOwn(imageModels, defaultImageModel) ? imageModels[defaultImageModel] : undefined;
    if (config === undefined) throw new Error(`No image model "${defaultImageModel}" in the agents config`);
    return {
        model: defaultImageModel,
        credits: Math.ceil(config.creditsPerImage),
        maxReferences: config.maxReferences,
    };
};

const reference = async ({ label, image }: TPromptReference<Buffer>): Promise<TImageReference> => {
    let data: Buffer;
    try {
        data = await referenceWebp(image);
    } catch {
        throw invalidPrompt(`The image of ${label} cannot be read`);
    }
    return { label, mimeType: 'image/webp', data: data.toString('base64') };
};

@Injectable()
export class ImageGenService {
    private readonly jobs: ImageJobs;
    private readonly imageModel: TImageModel;

    constructor(
        @Inject(AI_OPTIONS) options: TAiOptions,
        private readonly stories: StoryRepository,
        private readonly credits: AiCreditRepository,
        private readonly availability: AiAvailability,
        private readonly agents: AiAgents,
        @Inject(AGENT_CONNECTION) private readonly connection: TAgentConnection,
        @Inject(AI_IMAGE_LIMITER) private readonly limiter: LoginLimiter
    ) {
        this.jobs = new ImageJobs(options.gemini.maxPerStory);
        this.imageModel = imageModelOf(options.gemini);
    }

    async generate(
        ctx: TServerContext,
        owner: TImageOwner,
        id: string,
        rawBody: unknown
    ): Promise<TGenerateImageResult> {
        const fields = jsonObjectBody(rawBody);
        rejectUnknownFields(fields, ['version', 'prompt']);
        const version = versionField(fields);
        const prompt = textField(fields, 'prompt', IMAGE_PROMPT_MAX_LENGTH);
        if (owner === 'story') throw HttpError.badRequest('The story image cannot be generated');
        await this.requireUsable(ctx.storyId);
        this.countImage(ctx.storyId);
        if (prompt === '') throw HttpError.badRequest('Write a description of the picture first');
        if (owner === 'passages' && imageLinkPath(prompt) !== undefined) {
            throw HttpError.badRequest(
                'The description is an image link: replace it with a description to generate one'
            );
        }
        const release = this.jobs.start(ctx.storyId, `${owner}/${id}`);
        try {
            return await this.generateFor(ctx, { owner, id }, prompt, version);
        } finally {
            release();
        }
    }

    private async generateFor(
        ctx: TServerContext,
        imageOwner: TImageOwnerRef,
        prompt: string,
        version: string
    ): Promise<TGenerateImageResult> {
        const { storyId, sp } = ctx;
        // an unknown owner is a 404 before anything is generated
        await readImage(sp, imageOwner.owner, imageOwner.id);
        const generation = await this.imageGeneration(sp, imageOwner, prompt);
        const image = await this.connection.generateImage(storyId, generation);
        const webp = await storedWebp(Buffer.from(image.data, 'base64'));
        const stored = await settle(
            uploadImage(ctx, imageOwner.owner, imageOwner.id, { version, data: webp.toString('base64') })
        );
        // the image was made, so a stale version or a vanished owner is still charged
        const credits = await this.charge(storyId, image.usage);
        if (!stored.ok) throw stored.error;
        return { ...stored.value, credits };
    }

    private async imageGeneration(
        sp: SourceProject,
        imageOwner: TImageOwnerRef,
        prompt: string
    ): Promise<TImageGeneration> {
        const { model, maxReferences } = this.imageModel;
        const targets = await readMentionTargets(sp, imageOwner, uniqueMentions(prompt));
        const built = buildImagePrompt({ prompt, owner: imageOwner.owner, targets, maxReferences });
        return { model, prompt: built.prompt, references: await Promise.all(built.references.map(reference)) };
    }

    private async charge(storyId: string, usage: TImageUsage): Promise<number> {
        const { model, credits } = this.imageModel;
        const balance = await this.credits.chargeImage(storyId, {
            model,
            inputTokens: usage.promptTokens,
            outputTokens: usage.candidatesTokens,
            costMicroUsd: microUsdOf(usdOfCredits(credits)),
            credits,
        });
        this.agents.publish(storyId, { type: 'credits', credits: balance });
        return balance;
    }

    private async requireUsable(storyId: string): Promise<void> {
        if (!(await this.stories.aiFeature(storyId))) throw HttpError.of('ai_disabled', DISABLED_MESSAGE);
        if (!this.availability.imageGeneration) throw HttpError.of('ai_unavailable', IMAGE_UNAVAILABLE_MESSAGE);
        if ((await this.credits.balance(storyId)) <= 0) throw HttpError.of('ai_no_credits', NO_CREDITS_MESSAGE);
    }

    private countImage(storyId: string): void {
        if (this.limiter.isBlocked(storyId)) {
            throw HttpError.tooManyRequests('Too many images for this story, try again in a minute');
        }
        this.limiter.fail(storyId);
    }
}
