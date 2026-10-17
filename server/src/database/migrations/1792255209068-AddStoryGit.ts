import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryGit1792255209068 implements MigrationInterface {
    name = 'AddStoryGit1792255209068';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'CREATE TABLE `story_git` (' +
                '`storyId` varchar(64) NOT NULL, ' +
                '`remoteUrl` varchar(2048) NOT NULL, ' +
                '`branch` varchar(255) NOT NULL, ' +
                '`tokenEncrypted` text NULL, ' +
                '`authorName` varchar(255) NOT NULL, ' +
                '`authorEmail` varchar(255) NOT NULL, ' +
                '`version` int UNSIGNED NOT NULL, ' +
                '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
                '`updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
                'PRIMARY KEY (`storyId`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'ALTER TABLE `story_git` ADD CONSTRAINT `FK_a734ae55c37c1375bdfc469ba44` ' +
                'FOREIGN KEY (`storyId`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `story_git` DROP FOREIGN KEY `FK_a734ae55c37c1375bdfc469ba44`');
        await queryRunner.query('DROP TABLE `story_git`');
    }
}
