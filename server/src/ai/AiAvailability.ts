import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AGENT_CONNECTION, type TAgentConnection } from './agentConnection/TAgentConnection';

export const AI_HEALTH_RETRY_MS = 30_000;

@Injectable()
export class AiAvailability implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('Ai');
    private usable = false;
    private images = false;
    private imagesChecked = false;
    private reasonText = 'Not checked yet';
    private retryTimer: NodeJS.Timeout | null = null;
    private destroyed = false;

    constructor(@Inject(AGENT_CONNECTION) private readonly connection: TAgentConnection) {}

    // Claude agents can run
    get available(): boolean {
        return this.usable;
    }

    get imageGeneration(): boolean {
        return this.images;
    }

    // why the agents are unavailable
    get reason(): string {
        return this.reasonText;
    }

    async onModuleInit(): Promise<void> {
        await this.check();
    }

    onModuleDestroy(): void {
        this.destroyed = true;
        this.cancelRetry();
    }

    // returns whether the agents are available
    async check(): Promise<boolean> {
        const { agents, imageGeneration } = await this.connection.health();
        this.updateImages(imageGeneration);
        if (agents.available) {
            if (!this.usable) this.logger.log('AI agents are available');
            this.usable = true;
        } else {
            if (this.usable || agents.reason !== this.reasonText)
                this.logger.warn(`AI agents are unavailable: ${agents.reason}`);
            this.usable = false;
            this.reasonText = agents.reason;
        }
        if (this.usable && this.images) this.cancelRetry();
        else this.scheduleRetry();
        return this.usable;
    }

    private updateImages(imageGeneration: boolean): void {
        if (imageGeneration !== this.images || !this.imagesChecked) {
            if (imageGeneration) this.logger.log('AI image generation is available');
            else this.logger.warn('AI image generation is unavailable (no launcher, Gemini key or image model)');
        }
        this.images = imageGeneration;
        this.imagesChecked = true;
    }

    private scheduleRetry(): void {
        if (this.retryTimer || this.destroyed) return;
        this.retryTimer = setInterval(() => void this.check(), AI_HEALTH_RETRY_MS);
        this.retryTimer.unref();
    }

    private cancelRetry(): void {
        if (this.retryTimer) clearInterval(this.retryTimer);
        this.retryTimer = null;
    }
}
