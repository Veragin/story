import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/DatabaseModule';
import { PlayController } from './PlayController';
import { STANDALONE_PLAYER_HTML, standalonePlayerHtmlFromConfig } from './standalonePlayer';

@Module({
    imports: [DatabaseModule],
    controllers: [PlayController],
    providers: [
        { provide: STANDALONE_PLAYER_HTML, inject: [ConfigService], useFactory: standalonePlayerHtmlFromConfig },
    ],
})
export class PlayModule {}
