import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../database/DatabaseModule';
import { MailModule } from '../mail/MailModule';
import { AuthController } from './AuthController';
import { AUTH_OPTIONS, authOptionsFromConfig } from './authOptions';
import { CsrfGuard } from './CsrfGuard';
import { LoginLimiter } from './LoginLimiter';
import { PasswordResetController } from './PasswordResetController';
import {
    PASSWORD_RESET_OPTIONS,
    passwordResetOptionsFromConfig,
    RESET_REQUEST_LIMITER,
    resetRequestLimiter,
} from './passwordReset';
import { PlaySiteGuard } from './PlaySiteGuard';
import { SessionService } from './SessionService';
import { StoryAccessGuard } from './StoryAccessGuard';
import { UnmatchedStoryPathMiddleware } from './UnmatchedStoryPathMiddleware';

@Module({
    imports: [DatabaseModule, MailModule],
    controllers: [AuthController, PasswordResetController],
    providers: [
        { provide: AUTH_OPTIONS, inject: [ConfigService], useFactory: authOptionsFromConfig },
        { provide: LoginLimiter, useFactory: () => new LoginLimiter() },
        { provide: RESET_REQUEST_LIMITER, useFactory: resetRequestLimiter },
        { provide: PASSWORD_RESET_OPTIONS, inject: [ConfigService], useFactory: passwordResetOptionsFromConfig },
        SessionService,
        // global guards run in registration order: the play site and CSRF checks come before any story lookup
        { provide: APP_GUARD, useClass: PlaySiteGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: APP_GUARD, useClass: StoryAccessGuard },
    ],
    exports: [AUTH_OPTIONS, SessionService],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(UnmatchedStoryPathMiddleware)
            .forRoutes({ path: 'api/stories/*rest', method: RequestMethod.ALL });
    }
}
