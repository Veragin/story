import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/DatabaseModule';
import { StoriesModule } from '../stories/StoriesModule';
import { StoryFolders } from '../stories/StoryFolders';
import { createAgentConnection } from './agentConnection/agentConnectionFactory';
import { AGENT_CONNECTION } from './agentConnection/TAgentConnection';
import { AiAgents } from './AiAgents';
import { AiAvailability } from './AiAvailability';
import { AiController } from './AiController';
import { AI_MESSAGE_LIMITER, aiMessageLimiter } from './aiMessageLimiter';
import { AI_OPTIONS, aiOptionsFromConfig } from './aiOptions';
import { AiService } from './AiService';
import { AI_IMAGE_LIMITER, aiImageLimiter } from './imageGen/aiImageLimiter';
import { ImageGenService } from './imageGen/ImageGenService';

@Module({
    imports: [DatabaseModule, StoriesModule],
    controllers: [AiController],
    providers: [
        { provide: AI_OPTIONS, inject: [ConfigService], useFactory: aiOptionsFromConfig },
        { provide: AI_MESSAGE_LIMITER, inject: [AI_OPTIONS], useFactory: aiMessageLimiter },
        { provide: AI_IMAGE_LIMITER, inject: [AI_OPTIONS], useFactory: aiImageLimiter },
        { provide: AGENT_CONNECTION, inject: [AI_OPTIONS, StoryFolders], useFactory: createAgentConnection },
        AiAvailability,
        AiAgents,
        AiService,
        ImageGenService,
    ],
    exports: [AiAvailability, ImageGenService],
})
export class AiModule {}
