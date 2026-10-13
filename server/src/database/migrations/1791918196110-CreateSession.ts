import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSession1791918196110 implements MigrationInterface {
    name = 'CreateSession1791918196110';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'CREATE TABLE `session` (' +
                '`id` int UNSIGNED NOT NULL AUTO_INCREMENT, ' +
                '`tokenHash` char(64) NOT NULL, ' +
                '`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), ' +
                '`lastSeenAt` datetime(3) NOT NULL, ' +
                'UNIQUE INDEX `IDX_ff3b5bfd0767bd32942e5ccaad` (`tokenHash`), ' +
                'PRIMARY KEY (`id`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'CREATE TABLE `session_grant` (' +
                '`sessionId` int UNSIGNED NOT NULL, ' +
                '`storyId` varchar(64) NOT NULL, ' +
                '`expiresAt` datetime(3) NOT NULL, ' +
                'INDEX `IDX_0f263ab1b67323a5f59855b783` (`expiresAt`), ' +
                'PRIMARY KEY (`sessionId`, `storyId`)' +
                ') ENGINE=InnoDB'
        );
        await queryRunner.query(
            'ALTER TABLE `session_grant` ADD CONSTRAINT `FK_aa461a2606581169a787d425950` ' +
                'FOREIGN KEY (`sessionId`) REFERENCES `session`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
        await queryRunner.query(
            'ALTER TABLE `session_grant` ADD CONSTRAINT `FK_c8cd60a60099c82c8f8de15b781` ' +
                'FOREIGN KEY (`storyId`) REFERENCES `story`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE `session_grant` DROP FOREIGN KEY `FK_c8cd60a60099c82c8f8de15b781`');
        await queryRunner.query('ALTER TABLE `session_grant` DROP FOREIGN KEY `FK_aa461a2606581169a787d425950`');
        await queryRunner.query('DROP TABLE `session_grant`');
        await queryRunner.query('DROP TABLE `session`');
    }
}
