import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { remoteHttpError } from '../src/git/gitErrors';
import { GitCommandError, GitRunner, scrubber } from '../src/git/GitRunner';

const TOKEN = 'tok3n/with+chars';

let dir: string;

beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'story-git-runner-'));
    await new GitRunner({ cwd: dir }).run(['init', '-q', '-b', 'main']);
});

afterAll(() => rm(dir, { recursive: true, force: true }));

const failure = async (promise: Promise<unknown>): Promise<GitCommandError> => {
    try {
        await promise;
    } catch (e) {
        if (e instanceof GitCommandError) return e;
        throw e;
    }
    throw new Error('expected a GitCommandError');
};

describe('GitRunner', () => {
    it('scrubs the token, its URL encoding and the auth header', () => {
        const scrub = scrubber(TOKEN);
        const header = Buffer.from(`x-access-token:${TOKEN}`).toString('base64');
        expect(scrub(`a ${TOKEN} b ${encodeURIComponent(TOKEN)} c ${header}`)).toBe('a *** b *** c ***');
        expect(scrubber(null)('nothing')).toBe('nothing');
    });

    it('sends the token as an env header, never in argv, and scrubs it from output', async () => {
        const git = new GitRunner({ cwd: dir, token: TOKEN });
        expect(await git.text(['config', '--get', 'http.extraHeader'])).toBe('Authorization: Basic ***\n');
    });

    it('scrubs the token from a failure and keeps it out of the HTTP error', async () => {
        const git = new GitRunner({ cwd: dir, token: TOKEN });
        const e = await failure(git.run(['show', TOKEN]));
        expect(e.code).toBe(128);
        expect(e.message).not.toContain(TOKEN);
        expect(e.stderr).toContain('***');
        expect(JSON.stringify(remoteHttpError(e))).not.toContain(TOKEN);
    });

    it('turns non-zero exits into GitCommandError unless allowed', async () => {
        const git = new GitRunner({ cwd: dir });
        expect((await git.run(['diff', '--quiet'], { okCodes: [1] })).code).toBe(0);
        const e = await failure(git.run(['rev-parse', '--verify', 'nope']));
        expect([e.command, e.timedOut]).toEqual(['rev-parse', false]);
    });

    it('refuses non-https transports', async () => {
        const git = new GitRunner({ cwd: dir });
        const e = await failure(git.run(['ls-remote', 'ext::sh -c echo'], { network: true }));
        expect(e.stderr).toMatch(/transport 'ext' not allowed|not allowed/);
    });

    it('feeds stdin', async () => {
        const git = new GitRunner({ cwd: dir });
        expect((await git.text(['hash-object', '--stdin'], { input: 'x' })).trim()).toMatch(/^[0-9a-f]{40}$/);
    });
});
