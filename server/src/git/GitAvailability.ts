import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { errorMessage } from '../common/HttpError';
import { GIT_OPTIONS, type TGitOptions } from './gitOptions';
import { gitVersion } from './GitRunner';

@Injectable()
export class GitAvailability implements OnModuleInit {
    private readonly logger = new Logger('Git');
    private usable = false;

    constructor(@Inject(GIT_OPTIONS) private readonly options: TGitOptions) {}

    get available(): boolean {
        return this.usable;
    }

    // null while unavailable
    get tokenKey(): Buffer | null {
        return this.usable ? this.options.tokenKey : null;
    }

    async onModuleInit(): Promise<void> {
        if (this.options.tokenKey === null) {
            this.logger.log('Git is unavailable: GIT_TOKEN_KEY is not set');
            return;
        }
        try {
            const version = await gitVersion();
            this.usable = true;
            this.logger.log(`Git is available (${version})`);
        } catch (e) {
            this.logger.warn(`Git is unavailable: ${errorMessage(e)}`);
        }
    }
}
