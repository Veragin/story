import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { Story } from '../stories/Story';
import { Session } from './Session';

@Entity({ name: 'session_grant' })
export class SessionGrant {
    @PrimaryColumn({ type: 'int', unsigned: true })
    sessionId: number;

    @PrimaryColumn({ type: 'varchar', length: 64 })
    storyId: string;

    @Index()
    @Column({ type: 'datetime', precision: 3 })
    expiresAt: Date;

    @ManyToOne(() => Session, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sessionId' })
    session: Relation<Session>;

    @ManyToOne(() => Story, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'storyId' })
    story: Relation<Story>;
}
