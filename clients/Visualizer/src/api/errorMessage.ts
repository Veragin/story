import type { TApiErrorBody, TApiErrorCode } from '@story/protocol';
import { ApiError } from './ApiError';

type TGitErrorCode = Extract<TApiErrorCode, `git_${string}`>;

const withDetail = (text: string, body: TApiErrorBody) => (body.message ? `${text} (${body.message})` : text);

const GIT_MESSAGES: Record<TGitErrorCode, (body: TApiErrorBody) => string> = {
    git_unavailable: () => _('Git is not available on this server.'),
    git_not_configured: () => _('Git is not set up for this story yet.'),
    git_dirty: () => _('There are uncommitted changes. Commit them first.'),
    git_conflict: (body) =>
        _(
            'The merge conflicted and was undone, nothing changed. Conflicting files: %s. Continue on a new branch, or resolve the conflict outside the app.',
            (body.files ?? []).join(', ') || '?'
        ),
    git_rejected: () => _('The remote has newer commits. Pull first, then push again.'),
    git_auth: (body) => withDetail(_('The remote refused the access token.'), body),
    git_remote: (body) => withDetail(_('The remote could not be reached.'), body),
    git_nothing_to_commit: () => _('There is nothing to commit.'),
};

const isGitErrorCode = (code: TApiErrorCode): code is TGitErrorCode => code in GIT_MESSAGES;

export const errorBodyMessage = (body: TApiErrorBody, status?: number): string => {
    if (isGitErrorCode(body.error)) return GIT_MESSAGES[body.error](body);
    if (body.message) return `${body.error}: ${body.message}`;
    return status === undefined ? body.error : `${body.error} (${status})`;
};

export const errorMessage = (e: unknown): string => {
    if (e instanceof ApiError) {
        if (e.isNotImplemented) return 'The server does not implement this route yet (501).';
        return errorBodyMessage(e.body, e.status);
    }
    return e instanceof Error ? e.message : String(e);
};
