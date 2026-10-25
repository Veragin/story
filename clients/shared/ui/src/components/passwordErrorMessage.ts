const errorStatus = (err: unknown): unknown =>
    typeof err === 'object' && err !== null && 'status' in err ? err.status : undefined;

const messageOr = (err: unknown, fallback: string): string =>
    err instanceof Error && err.message ? err.message : fallback;

const tooManyAttempts = () => _('Too many wrong attempts. Try again in a few minutes.');

/** User-facing wording for a failed story login: 401, 429, else the error's message. */
export const passwordErrorMessage = (err: unknown): string => {
    const status = errorStatus(err);
    if (status === 401) return _('Wrong password.');
    if (status === 429) return tooManyAttempts();
    return messageOr(err, _('Could not unlock the story.'));
};

/** User-facing wording for a failed reset-link request: 429, else the error's message (a wrong email is a 400). */
export const resetRequestErrorMessage = (err: unknown): string =>
    errorStatus(err) === 429 ? tooManyAttempts() : messageOr(err, _('Could not send the link.'));

/** User-facing wording for a failed password reset, e.g. an expired link. */
export const resetPasswordErrorMessage = (err: unknown): string => messageOr(err, _('Could not set the password.'));
