import { HttpError } from '../common/HttpError';
import { isGitCommandError, type GitCommandError } from './GitRunner';

const AUTH =
    /Authentication failed|could not read (Username|Password)|terminal prompts disabled|Invalid username or password|HTTP Basic: Access denied|returned error: 40[13]/i;
const REJECTED = /\[rejected\]|\[remote rejected\]|non-fast-forward|fetch first|Updates were rejected/i;
const STALE_LEASE = /\(stale info\)/i;
const NO_REMOTE_REF = /couldn't find remote ref|Remote branch .* not found/i;
const REMOTE_REF_GONE = /remote ref does not exist/i;

const detail = (e: GitCommandError) => (e.stderr.trim() || e.stdout.trim()).split('\n').slice(-3).join('\n');

// a network command's failure is the remote's answer; anything unrecognised is still the remote's (502)
export const remoteHttpError = (e: unknown): unknown => {
    if (!isGitCommandError(e)) return e;
    if (e.timedOut) return HttpError.of('git_remote', `git ${e.command} timed out`);
    const text = `${e.stderr}\n${e.stdout}`;
    if (AUTH.test(text)) return HttpError.of('git_auth', `The remote refused the credentials: ${detail(e)}`);
    if (STALE_LEASE.test(text)) {
        return HttpError.of('git_rejected', `The remote changed since the last fetch: fetch first (${detail(e)})`);
    }
    if (REJECTED.test(text)) {
        return HttpError.of('git_rejected', `The remote has commits this story lacks: pull first (${detail(e)})`);
    }
    if (NO_REMOTE_REF.test(text)) return HttpError.of('git_remote', `No such branch on the remote: ${detail(e)}`);
    return HttpError.of('git_remote', detail(e) || e.message);
};

export const isRemoteRefGone = (e: unknown): boolean =>
    isGitCommandError(e) && REMOTE_REF_GONE.test(`${e.stderr}\n${e.stdout}`);

export const asRemote = async <T>(promise: Promise<T>): Promise<T> => {
    try {
        return await promise;
    } catch (e) {
        throw remoteHttpError(e);
    }
};
