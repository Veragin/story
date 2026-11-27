import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Story } from './Story';

@Entity({ name: 'story_ai_session' })
@Index(['storyId', 'lastUsedAt'])
export class StoryAiSession {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    sessionId: string;

    @Column({ type: 'varchar', length: 64 })
    storyId: string;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'int', unsigned: true, nullable: true })
    pid: number | null;

    @Column({ type: 'varchar', length: 128, nullable: true })
    containerName: string | null;

    @CreateDateColumn({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    createdAt: Date;

    @Column({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    lastUsedAt: Date;

    @ManyToOne(() => Story, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storyId' })
    story: Relation<Story>;
}
