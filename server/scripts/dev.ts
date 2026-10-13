import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'chokidar';

// `node --watch` loses a file once an editor saves it by rename (atomic save); chokidar re-attaches
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCHED = ['src', '../protocol/src', '../clients/shared/utils/src'].map((dir) => path.resolve(SERVER_ROOT, dir));
const DEBOUNCE_MS = 150;
const LOADER = ['--import', '@swc-node/register/esm-register'];

let child: ChildProcess | undefined;
let timer: NodeJS.Timeout | undefined;
let changed: string | undefined;
let restarting = false;
let closing = false;

const start = () => {
    child = spawn(process.execPath, [...LOADER, 'src/main.ts'], { cwd: SERVER_ROOT, stdio: 'inherit' });
    child.on('exit', (code) => {
        if (code) console.log(`[dev] server exited with code ${code}, waiting for a change`);
    });
};

const stop = async () => {
    const running = child;
    child = undefined;
    if (!running || running.exitCode !== null || running.signalCode !== null) return;
    const exited = once(running, 'exit');
    running.kill('SIGTERM');
    await exited;
};

const restart = async () => {
    if (restarting) return;
    restarting = true;
    while (changed && !closing) {
        console.log(`[dev] ${path.relative(SERVER_ROOT, changed)} changed, restarting`);
        changed = undefined;
        await stop();
        start();
    }
    restarting = false;
};

const schedule = (file: string) => {
    changed = file;
    clearTimeout(timer);
    timer = setTimeout(() => void restart(), DEBOUNCE_MS);
};

const watcher = watch(WATCHED, { ignoreInitial: true, ignored: (file) => file.includes('node_modules') });

const shutdown = async () => {
    closing = true;
    clearTimeout(timer);
    await watcher.close();
    await stop();
    process.exit(0);
};

watcher.on('all', (_event, file) => schedule(file));
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
start();
