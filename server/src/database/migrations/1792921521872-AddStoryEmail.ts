import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStoryEmail1792921521872 implements MigrationInterface {
    name = 'AddStoryEmail1792921521872';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `story` ADD `email` varchar(255) NULL');
        await queryRunner.query(
            'CREATE TABLE `story_password_reset` (' +
                '`storyId` varchar(64) NOT NULL, ' +
                '`tokenHash` varchar(64) NOT NULL, ' +
                '`expiresAt` datetime(3) NOT NULL, ' +
                '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
                'PRIMARY KEY (`storyId`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'ALTER TABLE `story_password_reset` ADD CONSTRAINT `FK_8a2b8d5528e5c3bded8a326ba9b` ' +
                'FOREIGN KEY (`storyId`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `story_password_reset` DROP FOREIGN KEY `FK_8a2b8d5528e5c3bded8a326ba9b`');
        await queryRunner.query('DROP TABLE `story_password_reset`');
        await queryRunner.query('ALTER TABLE `story` DROP COLUMN `email`');
    }
}
