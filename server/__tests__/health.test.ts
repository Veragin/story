import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GLOBAL_ROUTES, type THealthDto } from '@story/protocol';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/AppModule';

describe('GET /api/health', () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = moduleRef.createNestApplication();
        await app.listen(0, '127.0.0.1');
        baseUrl = await app.getUrl();
    });

    afterAll(async () => {
        await app.close();
    });

    it('uses the test database', async () => {
        const [row] = await app.get(DataSource).query('SELECT DATABASE() AS db');
        expect(row).toEqual({ db: 'story_test' });
    });

    it('answers with THealthDto after pinging the database', async () => {
        const response = await fetch(`${baseUrl}${GLOBAL_ROUTES.health.path}`);
        expect(response.status).toBe(200);
        const expected: THealthDto = {
            ok: true,
            service: '@story/server',
            storiesRoot: expect.any(String),
            watching: true,
            database: 'up',
            git: 'unavailable',
        };
        expect(await response.json()).toEqual(expected);
    });
});
