import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSessionLastSeenAt1792108800000 implements MigrationInterface {
    name = 'DropSessionLastSeenAt1792108800000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `session` DROP COLUMN `lastSeenAt`');
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE `session` ADD `lastSeenAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)'
        );
    }
}
