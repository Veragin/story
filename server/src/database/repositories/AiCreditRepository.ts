import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { StoryAiCredit } from '../entities/StoryAiCredit';
import { StoryAiUsage } from '../entities/StoryAiUsage';

export type TAiUsageRecord = {
    sessionId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costMicroUsd: number;
    credits: number;
};

export type TAiImageUsageRecord = {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicroUsd: number;
    credits: number;
};

type TUsageRow = Omit<StoryAiUsage, 'id' | 'storyId' | 'createdAt' | 'story'>;

const assertCredits = (credits: number, positive: boolean) => {
    if (!Number.isSafeInteger(credits) || credits < 0 || (positive && credits === 0)) {
        throw new Error(`Not a credit amount: ${credits}`);
    }
};

@Injectable()
export class AiCreditRepository {
    constructor(private readonly dataSource: DataSource) {}

    async balance(storyId: string, manager: EntityManager = this.dataSource.manager): Promise<number> {
        const row = await manager.findOneBy(StoryAiCredit, { storyId });
        return row?.balance ?? 0;
    }

    async charge(storyId: string, usage: TAiUsageRecord): Promise<number> {
        return await this.insertUsage(storyId, { kind: 'turn', ...usage });
    }

    async chargeImage(storyId: string, usage: TAiImageUsageRecord): Promise<number> {
        return await this.insertUsage(storyId, {
            kind: 'image',
            sessionId: null,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
            ...usage,
        });
    }

    async topUp(storyId: string, credits: number): Promise<number> {
        assertCredits(credits, true);
        return await this.dataSource.transaction((manager) => this.addToBalance(storyId, credits, manager));
    }

    // returns the new balance
    private async insertUsage(storyId: string, usage: TUsageRow): Promise<number> {
        assertCredits(usage.credits, false);
        return await this.dataSource.transaction(async (manager) => {
            await manager.insert(StoryAiUsage, { storyId, ...usage });
            return this.addToBalance(storyId, -usage.credits, manager);
        });
    }

    // returns the new balance; the row is created on first use
    private async addToBalance(storyId: string, delta: number, manager: EntityManager): Promise<number> {
        await manager.query(
            'INSERT INTO `story_ai_credit` (`storyId`, `balance`) VALUES (?, ?) ' +
                'ON DUPLICATE KEY UPDATE `balance` = `balance` + ?',
            [storyId, delta, delta]
        );
        return this.balance(storyId, manager);
    }
}
