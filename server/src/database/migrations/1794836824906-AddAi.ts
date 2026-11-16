import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAi1794836824906 implements MigrationInterface {
    name = 'AddAi1794836824906';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `story` ADD `aiFeature` tinyint NOT NULL DEFAULT 0');
        await queryRunner.query(
            'CREATE TABLE `story_ai_credit` (' +
                '`storyId` varchar(64) NOT NULL, ' +
                '`balance` bigint NOT NULL DEFAULT 0, ' +
                '`updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
                'PRIMARY KEY (`storyId`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'CREATE TABLE `story_ai_usage` (' +
                '`id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, ' +
                '`storyId` varchar(64) NOT NULL, ' +
                '`sessionId` varchar(64) NOT NULL, ' +
                '`model` varchar(128) NOT NULL, ' +
                '`inputTokens` int UNSIGNED NOT NULL, ' +
                '`outputTokens` int UNSIGNED NOT NULL, ' +
                '`cacheReadTokens` int UNSIGNED NOT NULL, ' +
                '`cacheCreationTokens` int UNSIGNED NOT NULL, ' +
                '`costMicroUsd` bigint UNSIGNED NOT NULL, ' +
                '`credits` int UNSIGNED NOT NULL, ' +
                '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
                'INDEX `IDX_9a6e8396b2e2c454961ce1ae74` (`storyId`, `createdAt`), ' +
                'PRIMARY KEY (`id`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'CREATE TABLE `story_ai_session` (' +
                '`sessionId` varchar(64) NOT NULL, ' +
                '`storyId` varchar(64) NOT NULL, ' +
                '`title` varchar(255) NOT NULL, ' +
                '`pid` int UNSIGNED NULL, ' +
                '`containerName` varchar(128) NULL, ' +
                '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
                '`lastUsedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
                'INDEX `IDX_30656b6444cbbd63855ec2ba9f` (`storyId`, `lastUsedAt`), ' +
                'PRIMARY KEY (`sessionId`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'ALTER TABLE `story_ai_credit` ADD CONSTRAINT `FK_fc517dcfa2677409a3c9cebdd18` ' +
                'FOREIGN KEY (`storyId`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
        await queryRunner.query(
            'ALTER TABLE `story_ai_usage` ADD CONSTRAINT `FK_4e4194ab6537d158ae770d36d1c` ' +
                'FOREIGN KEY (`storyId`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
        await queryRunner.query(
            'ALTER TABLE `story_ai_session` ADD CONSTRAINT `FK_7951a4310aac27429dca0d725da` ' +
                'FOREIGN KEY (`storyId`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `story_ai_session` DROP FOREIGN KEY `FK_7951a4310aac27429dca0d725da`');
        await queryRunner.query('ALTER TABLE `story_ai_usage` DROP FOREIGN KEY `FK_4e4194ab6537d158ae770d36d1c`');
        await queryRunner.query('ALTER TABLE `story_ai_credit` DROP FOREIGN KEY `FK_fc517dcfa2677409a3c9cebdd18`');
        await queryRunner.query('DROP TABLE `story_ai_session`');
        await queryRunner.query('DROP TABLE `story_ai_usage`');
        await queryRunner.query('DROP TABLE `story_ai_credit`');
        await queryRunner.query('ALTER TABLE `story` DROP COLUMN `aiFeature`');
    }
}
