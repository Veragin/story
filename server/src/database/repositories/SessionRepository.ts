import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Session } from '../entities/Session';

@Injectable()
export class SessionRepository {
    constructor(private readonly dataSource: DataSource) {}

    findByTokenHash(tokenHash: string, manager: EntityManager = this.dataSource.manager): Promise<Session | null> {
        return manager.findOneBy(Session, { tokenHash });
    }

    count(manager: EntityManager = this.dataSource.manager): Promise<number> {
        return manager.count(Session);
    }

    async insert(tokenHash: string, manager: EntityManager = this.dataSource.manager): Promise<number> {
        const result = await manager.insert(Session, { tokenHash });
        const id: unknown = result.identifiers[0]?.id;
        if (typeof id !== 'number') throw new Error('Session insert returned no id');
        return id;
    }

    async delete(id: number, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.delete(Session, { id });
    }

    async deleteByTokenHash(tokenHash: string, manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.delete(Session, { tokenHash });
    }

    async deleteWithoutGrants(manager: EntityManager = this.dataSource.manager): Promise<void> {
        await manager.query(
            'DELETE `session` FROM `session` LEFT JOIN `session_grant` ON `session_grant`.`sessionId` = `session`.`id` ' +
                'WHERE `session_grant`.`sessionId` IS NULL'
        );
    }
}
