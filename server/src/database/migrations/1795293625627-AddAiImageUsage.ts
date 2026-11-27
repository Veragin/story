import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiImageUsage1795293625627 implements MigrationInterface {
    name = 'AddAiImageUsage1795293625627';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TABLE `story_ai_usage` ADD `kind` enum ('turn', 'image') NOT NULL DEFAULT 'turn' AFTER `storyId`"
        );
        await queryRunner.query('ALTER TABLE `story_ai_usage` MODIFY `sessionId` varchar(64) NULL');
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("DELETE FROM `story_ai_usage` WHERE `kind` = 'image'");
        await queryRunner.query('ALTER TABLE `story_ai_usage` MODIFY `sessionId` varchar(64) NOT NULL');
        await queryRunner.query('ALTER TABLE `story_ai_usage` DROP COLUMN `kind`');
    }
}
