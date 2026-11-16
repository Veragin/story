import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AGENT_CONNECTION, type TAgentConnection } from './agentConnection/TAgentConnection';

export const AI_HEALTH_RETRY_MS = 30_000;

@Injectable()
export class AiAvailability implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('Ai');
    private usable = false;
    private reasonText = 'Not checked yet';
    private retryTimer: NodeJS.Timeout | null = null;
    private destroyed = false;

    constructor(@Inject(AGENT_CONNECTION) private readonly connection: TAgentConnection) {}

    get available(): boolean {
        return this.usable;
    }

    // why it is unavailable
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

    async check(): Promise<boolean> {
        const health = await this.connection.health();
        if (health.available) {
            if (!this.usable) this.logger.log('AI agents are available');
            this.usable = true;
            this.cancelRetry();
            return true;
        }
        if (this.usable || health.reason !== this.reasonText)
            this.logger.warn(`AI agents are unavailable: ${health.reason}`);
        this.usable = false;
        this.reasonText = health.reason;
        this.scheduleRetry();
        return false;
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
