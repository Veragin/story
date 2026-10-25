import type { TMail } from '../../src/mail/Mailer';

export class FakeMailer {
    readonly sent: TMail[] = [];
    failure: Error | null = null;

    send(mail: TMail): Promise<void> {
        if (this.failure) return Promise.reject(this.failure);
        this.sent.push(mail);
        return Promise.resolve();
    }
}
