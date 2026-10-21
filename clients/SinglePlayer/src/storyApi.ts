import { buildGlobalPath, type TStoryListItemDto } from '@story/protocol';

export class StoryApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'StoryApiError';
    }
}

const check = async (res: Response): Promise<Response> => {
    if (res.ok) return res;
    let message = `${res.status} ${res.statusText}`;
    try {
        const body: { message?: string } = await res.json();
        if (body.message) message = body.message;
    } catch {
        // not JSON: keep the status line
    }
    throw new StoryApiError(res.status, message);
};

export const fetchOk = async (url: string, init?: RequestInit): Promise<Response> => check(await fetch(url, init));

export const getStoryName = async (storyId: string): Promise<string> => {
    const stories: TStoryListItemDto[] = await (await fetchOk(buildGlobalPath('listStories', {}))).json();
    return stories.find((s) => s.id === storyId)?.name ?? storyId;
};

export const login = async (storyId: string, password: string): Promise<void> => {
    await fetchOk(buildGlobalPath('login', { storyId }), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
    });
};
