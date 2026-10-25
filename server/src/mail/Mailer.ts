import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { MAIL_OPTIONS, type TMailOptions } from './mailOptions';

export type TMail = { to: string; subject: string; text: string };

@Injectable()
export class Mailer implements OnModuleDestroy {
    private readonly transport: Transporter | null;

    constructor(@Inject(MAIL_OPTIONS) private readonly options: TMailOptions) {
        this.transport = options.smtpUrl ? createTransport(options.smtpUrl) : null;
    }

    async send(mail: TMail): Promise<void> {
        if (!this.transport) {
            console.info(
                `[mail] no SMTP_URL, not sent:\nFrom: ${this.options.from}\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}`
            );
            return;
        }
        await this.transport.sendMail({ from: this.options.from, ...mail });
    }

    onModuleDestroy(): void {
        this.transport?.close();
    }
}
