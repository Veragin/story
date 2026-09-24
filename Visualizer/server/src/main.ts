import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErrorEnvelopeFilter } from './common/ErrorEnvelopeFilter';

/**
 * Bootstrap (VISUALIZER_PLAN §5.1, §5.2).
 *
 * `reflect-metadata` is imported first and by side effect: Nest reads the `design:paramtypes`
 * the compiler emitted through `Reflect.getMetadata`, and that API does not exist until this
 * polyfill has run. Importing it anywhere later than the first line is a race with module
 * evaluation order that fails as "Nest can't resolve dependencies of X (?)" — the same symptom
 * as the esbuild problem §5.2 describes, from a different cause.
 *
 * Run from TypeScript source with no build step (RP §7) under `@swc-node/register`; see
 * `package.json` for why not `tsx`.
 */

/** §5.1: port 8123, `/api` prefix. */
const PORT = Number(process.env.VISUALIZER_SERVER_PORT ?? 8123);

const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.create(AppModule, { bufferLogs: false });

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
        new ValidationPipe({
            // Strip properties the DTO does not declare, and refuse the request if any were
            // sent. The writers in Phase 5 turn request bodies into file contents, so an
            // unexpected property is exactly the thing that must not reach a writer.
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: false },
        })
    );

    // Every 4xx answers `{ success: false, error }` (§5.3).
    app.useGlobalFilters(new ErrorEnvelopeFilter());

    /**
     * CORS is on, and it is not laziness.
     *
     * In development the client reaches the server through Vite's `/api` proxy, so requests are
     * same-origin and CORS never applies. It matters for the case the proxy does not cover: an
     * author who opens the client from a different host or port, or curls the API from a page.
     * The server is a developer tool bound to a local port that reads and writes one repo — it
     * is not a multi-tenant service, and there is no session for a cross-site request to ride.
     */
    app.enableCors({ origin: true, credentials: false });

    // `0.0.0.0`, not the default `localhost`: inside the dev container a `localhost` bind is
    // unreachable from the host, which is the whole point of publishing the port.
    await app.listen(PORT, '0.0.0.0');

    new Logger('Bootstrap').log(`Visualizer server listening on http://0.0.0.0:${PORT}/api`);
};

await bootstrap();
