import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryColumn,
    UpdateDateColumn,
    VersionColumn,
    type Relation,
} from 'typeorm';
import { Story } from './Story';

@Entity({ name: 'story_git' })
export class StoryGit {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    storyId: string;

    @Column({ type: 'varchar', length: 2048 })
    remoteUrl: string;

    @Column({ type: 'varchar', length: 255 })
    branch: string;

    @Column({ type: 'text', nullable: true })
    tokenEncrypted: string | null;

    @Column({ type: 'varchar', length: 255 })
    authorName: string;

    @Column({ type: 'varchar', length: 255 })
    authorEmail: string;

    @VersionColumn({ type: 'int', unsigned: true })
    version: number;

    @CreateDateColumn({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
    createdAt: Date;

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
