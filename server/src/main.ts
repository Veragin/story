import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './AppModule';
import type { TEnv } from './config/env';

const HOST = '0.0.0.0';

const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
const port = app.get<ConfigService<TEnv, true>>(ConfigService).get('PORT', { infer: true });
await app.listen(port, HOST);
console.log(`[server] listening on http://${HOST}:${port}`);
