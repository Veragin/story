import type { ConfigService } from '@nestjs/config';
import type { TEnv } from '../config/env';

export const MAIL_OPTIONS = Symbol('MAIL_OPTIONS');

export type TMailOptions = {
    smtpUrl: string | null;
    from: string;
};

export const mailOptionsFromConfig = (config: ConfigService<TEnv, true>): TMailOptions => ({
    smtpUrl: config.get('SMTP_URL', { infer: true }),
    from: config.get('MAIL_FROM', { infer: true }),
});
