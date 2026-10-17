import { execFile } from 'node:child_process';

export const NETWORK_TIMEOUT_MS = 60_000;
export const LOCAL_TIMEOUT_MS = 10_000;

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const SCRUBBED = '***';

export type TGitRunnerOptions = {
    cwd: string;
    token?: string | null;
    allowFileRemotes?: boolean;
};

export type TGitRunOptions = {
    network?: boolean;
    input?: string;
    timeoutMs?: number;
    okCodes?: readonly number[];
    config?: Readonly<Record<string, string>>;
};

export type TGitResult = { stdout: string; stderr: string; code: number };

export class GitCommandError extends Error {
    constructor(
        readonly command: string,
        readonly code: number | null,
        readonly stdout: string,
        readonly stderr: string,
        readonly timedOut: boolean
    ) {
        super(
            `git ${command} ${timedOut ? 'timed out' : `failed (${code ?? 'killed'})`}: ${stderr.trim() || stdout.trim()}`
        );
        this.name = 'GitCommandError';
    }
}

export const isGitCommandError = (e: unknown): e is GitCommandError => e instanceof GitCommandError;

const basicAuth = (token: string) => Buffer.from(`x-access-token:${token}`).toString('base64');

export const scrubber = (token: string | null | undefined): ((text: string) => string) => {
    if (!token) return (text) => text;
    const secrets = [basicAuth(token), token, encodeURIComponent(token)];
    return (text) => secrets.reduce((out, secret) => out.split(secret).join(SCRUBBED), text);
};

const SAFETY_FLAGS = [
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'core.fsmonitor=false',
    '-c',
    'core.quotePath=false',
    '-c',
    'commit.gpgSign=false',
    '-c',
    'credential.helper=',
    '-c',
    'protocol.allow=never',
    '-c',
    'protocol.https.allow=always',
];

const FILE_REMOTE_FLAGS = ['-c', 'protocol.file.allow=always'];

// an inherited GIT_DIR or GIT_INDEX_FILE (e.g. inside a hook) would point git at another repo
const baseEnv = (): NodeJS.ProcessEnv =>
    Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

const authEnv = (token: string | null | undefined): NodeJS.ProcessEnv =>
    token
        ? {
              GIT_CONFIG_COUNT: '1',
              GIT_CONFIG_KEY_0: 'http.extraHeader',
              GIT_CONFIG_VALUE_0: `Authorization: Basic ${basicAuth(token)}`,
          }
        : {};

export class GitRunner {
    private readonly scrub: (text: string) => string;
    private readonly flags: readonly string[];
    private readonly env: NodeJS.ProcessEnv;

    constructor(private readonly options: TGitRunnerOptions) {
        this.scrub = scrubber(options.token);
        this.flags = options.allowFileRemotes ? [...SAFETY_FLAGS, ...FILE_REMOTE_FLAGS] : SAFETY_FLAGS;
        this.env = {
            ...baseEnv(),
            LC_ALL: 'C',
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: '',
            SSH_ASKPASS: '',
            GIT_CONFIG_NOSYSTEM: '1',
            GIT_CONFIG_GLOBAL: '/dev/null',
            ...authEnv(options.token),
        };
    }

    get cwd(): string {
        return this.options.cwd;
    }

    run(
        args: readonly string[],
        { network = false, input, timeoutMs, okCodes = [], config = {} }: TGitRunOptions = {}
    ) {
        const timeout = timeoutMs ?? (network ? NETWORK_TIMEOUT_MS : LOCAL_TIMEOUT_MS);
        const command = args[0] ?? '';
        return new Promise<TGitResult>((resolve, reject) => {
            const child = execFile(
                'git',
                [
                    ...this.flags,
                    ...Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${value}`]),
                    ...args,
                ],
                { cwd: this.options.cwd, env: this.env, timeout, maxBuffer: MAX_OUTPUT_BYTES, encoding: 'utf8' },
                (error, stdout, stderr) => {
                    const out = this.scrub(stdout);
                    const err = this.scrub(stderr);
                    if (!error) return resolve({ stdout: out, stderr: err, code: 0 });
                    const code = typeof error.code === 'number' ? error.code : null;
                    if (code !== null && okCodes.includes(code)) return resolve({ stdout: out, stderr: err, code });
                    reject(new GitCommandError(command, code, out, err, error.killed === true && code === null));
                }
            );
            // a git that exits without reading its stdin is judged by its exit code
            child.stdin?.on('error', () => undefined);
            child.stdin?.end(input);
        });
    }

    async text(args: readonly string[], options?: TGitRunOptions): Promise<string> {
        return (await this.run(args, options)).stdout;
    }
}

export const gitVersion = async (): Promise<string> =>
    (await new GitRunner({ cwd: process.cwd() }).text(['--version'])).trim();
