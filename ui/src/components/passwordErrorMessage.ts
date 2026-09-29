/**
 * How `PasswordDialog` words a rejected `onSubmit`. An error with a numeric `status` (every app's
 * `ApiError` has one) gets the login route's cases: 401 wrong password, 429 too many attempts
 * (the server allows 10 wrong ones per 10 minutes). Anything else shows its `message`.
 */
export const passwordErrorMessage = (err: unknown): string => {
    const status = (err as { status?: unknown } | null)?.status;
    if (status === 401) return _('Wrong password.');
    if (status === 429) return _('Too many wrong attempts. Try again in a few minutes.');
    if (err instanceof Error && err.message) return err.message;
    return _('Could not unlock the story.');
};
