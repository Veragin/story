import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Story } from './Story';

@Entity({ name: 'story_password_reset' })
export class StoryPasswordReset {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    storyId: string;

    @Column({ type: 'varchar', length: 64 })
    tokenHash: string;

    @Column({ type: 'datetime', precision: 3 })
    expiresAt: Date;

    @CreateDateColumn({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    createdAt: Date;

    // 1:1 through the primary key; @OneToOne would add a redundant unique index
    @ManyToOne(() => Story, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storyId' })
    story: Relation<Story>;
}
