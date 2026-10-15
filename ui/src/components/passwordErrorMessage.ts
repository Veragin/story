/** User-facing wording for a failed story login: 401, 429, else the error's message. */
export const passwordErrorMessage = (err: unknown): string => {
    const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : undefined;
    if (status === 401) return _('Wrong password.');
    if (status === 429) return _('Too many wrong attempts. Try again in a few minutes.');
    if (err instanceof Error && err.message) return err.message;
    return _('Could not unlock the story.');
};
