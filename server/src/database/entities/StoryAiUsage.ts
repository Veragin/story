import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    type Relation,
} from 'typeorm';
import { BIGINT_NUMBER } from '../bigintNumber';
import { Story } from './Story';

export const AI_USAGE_KINDS = ['turn', 'image'] as const;
export type TAiUsageKind = (typeof AI_USAGE_KINDS)[number];

@Entity({ name: 'story_ai_usage' })
@Index(['storyId', 'createdAt'])
export class StoryAiUsage {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: string;

    @Column({ type: 'varchar', length: 64 })
    storyId: string;

    @Column({ type: 'enum', enum: AI_USAGE_KINDS, default: 'turn' })
    kind: TAiUsageKind;

    // null for an image
    @Column({ type: 'varchar', length: 64, nullable: true })
    sessionId: string | null;

    @Column({ type: 'varchar', length: 128 })
    model: string;

    @Column({ type: 'int', unsigned: true })
    inputTokens: number;

    @Column({ type: 'int', unsigned: true })
    outputTokens: number;

    @Column({ type: 'int', unsigned: true })
    cacheReadTokens: number;

    @Column({ type: 'int', unsigned: true })
    cacheCreationTokens: number;

    @Column({ type: 'bigint', unsigned: true, transformer: BIGINT_NUMBER })
    costMicroUsd: number;

    @Column({ type: 'int', unsigned: true })
    credits: number;

    @CreateDateColumn({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    createdAt: Date;

    @ManyToOne(() => Story, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storyId' })
    story: Relation<Story>;
}
