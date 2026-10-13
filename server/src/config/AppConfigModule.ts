import { ConfigModule } from '@nestjs/config';
import { parseEnv } from './env';

export const AppConfigModule = ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    validate: parseEnv,
});
