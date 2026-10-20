/** User-facing check of a git remote URL, `null` when the server would accept its form. */
export const remoteUrlErrorMessage = (value: string): string | null => {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return _('Use an https:// URL');
        if (url.username || url.password) return _('Put the token in its own field, not in the URL');
        return null;
    } catch {
        return _('Not a URL, e.g. https://github.com/me/story.git');
    }
};
