import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { BIGINT_NUMBER } from '../bigintNumber';
import { Story } from './Story';

@Entity({ name: 'story_ai_credit' })
export class StoryAiCredit {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    storyId: string;

    // signed: the last turn may overdraw
    @Column({ type: 'bigint', default: 0, transformer: BIGINT_NUMBER })
    balance: number;

    @UpdateDateColumn({
        type: 'datetime',
        precision: 6,
        default: () => 'CURRENT_TIMESTAMP(6)',
        onUpdate: 'CURRENT_TIMESTAMP(6)',
    })
    updatedAt: Date;

    // 1:1 through the primary key; @OneToOne would add a redundant unique index
    @ManyToOne(() => Story, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storyId' })
    story: Relation<Story>;
}
