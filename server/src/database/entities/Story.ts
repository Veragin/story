import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

@Entity({ name: 'story' })
export class Story {
    @PrimaryColumn({ type: 'varchar', length: 64 })
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 255 })
    author: string;

    @Column({ type: 'varchar', length: 255 })
    passwordHash: string;

    @Column({ type: 'int', unsigned: true })
    mapWidth: number;

    @Column({ type: 'int', unsigned: true })
    mapHeight: number;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'boolean' })
    isPublic: boolean;

    @VersionColumn({ type: 'int', unsigned: true })
    version: number;

    @CreateDateColumn({ type: 'datetime', precision: 6 })
    createdAt: Date;

    @UpdateDateColumn({ type: 'datetime', precision: 6 })
    updatedAt: Date;
}
