import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStory1791916173791 implements MigrationInterface {
    name = 'CreateStory1791916173791';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'CREATE TABLE `story` (' +
                '`id` varchar(64) NOT NULL, ' +
                '`name` varchar(255) NOT NULL, ' +
                '`author` varchar(255) NOT NULL, ' +
                '`passwordHash` varchar(255) NOT NULL, ' +
                '`mapWidth` int UNSIGNED NOT NULL, ' +
                '`mapHeight` int UNSIGNED NOT NULL, ' +
                '`description` text NOT NULL, ' +
                '`isPublic` tinyint NOT NULL, ' +
                '`version` int UNSIGNED NOT NULL, ' +
                '`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), ' +
                '`updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), ' +
                'PRIMARY KEY (`id`)' +
                ') ENGINE=InnoDB'
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE `story`');
    }
}
