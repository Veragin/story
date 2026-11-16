import { AgentProcesses } from './AgentProcesses';
import { readAiToken } from './aiToken';
import { launcherOptionsFromEnv } from './launcherOptions';
import { createLauncherServer } from './launcherServer';
import { createSandboxDriver } from './sandbox/createSandboxDriver';
import { readSecretFile } from './secretFile';

const log = (message: string) => console.log(`[ai-launcher] ${message}`);

const logFailure = async (what: string, task: () => Promise<void>) => {
    try {
        await task();
    } catch (e) {
        log(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
};

const main = async () => {
    const options = launcherOptionsFromEnv(process.env);
    const key = await readSecretFile(options.keyFile);
    if (!key) throw new Error(`The launcher key file ${options.keyFile} is missing or empty`);
    const token = await readAiToken(options.tokenFile);
    log(
        token
            ? `Anthropic token: ${token.kind}`
            : `no usable Anthropic token in ${options.tokenFile}; agents are refused`
    );

    const driver = createSandboxDriver(options, token);
    const processes = new AgentProcesses(driver, undefined, log);
    await logFailure('agent network setup', async () => log(`agent network: ${await processes.ensureNetwork()}`));
    await logFailure('orphan cleanup', async () =>
        log(`removed ${await processes.cleanupOrphans()} orphaned agent container(s)`)
    );

    const server = createLauncherServer({
        key,
        tokenKind: token?.kind ?? null,
        driver,
        processes,
        limits: { models: options.models, maxBudgetUsd: options.maxBudgetUsd },
        log,
    });
    server.listen(options.port, () => log(`listening on ${options.port} (driver ${driver.name})`));

    const shutdown = async () => {
        server.close();
        await processes.stopAll();
        process.exit(0);
    };
    process.once('SIGTERM', () => void shutdown());
    process.once('SIGINT', () => void shutdown());
};

try {
    await main();
} catch (e) {
    console.error(`[ai-launcher] ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
}
