import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mailer } from './Mailer';
import { MAIL_OPTIONS, mailOptionsFromConfig } from './mailOptions';

@Module({
    providers: [{ provide: MAIL_OPTIONS, inject: [ConfigService], useFactory: mailOptionsFromConfig }, Mailer],
    exports: [Mailer],
})
export class MailModule {}
