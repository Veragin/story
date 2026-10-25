import { PASSWORD_RESET_TOKEN_PARAM } from '@story/protocol';

export type TResetLink = { storyId: string; token: string };

const STORY_PARAM = 'story';

export const readResetLink = (search: string): TResetLink | null => {
    const params = new URLSearchParams(search);
    const storyId = params.get(STORY_PARAM);
    const token = params.get(PASSWORD_RESET_TOKEN_PARAM);
    return storyId && token ? { storyId, token } : null;
};

export const dropResetLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(STORY_PARAM);
    url.searchParams.delete(PASSWORD_RESET_TOKEN_PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
};
