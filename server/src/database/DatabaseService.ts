import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

@Injectable()
export class DatabaseService {
    constructor(private readonly dataSource: DataSource) {}

    transaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
        return this.dataSource.transaction(fn);
    }

    async ping(): Promise<void> {
        await this.dataSource.query('SELECT 1');
    }
}
