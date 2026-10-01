export class StoryApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'StoryApiError';
    }
}

type TStoryAccess = { canEdit: boolean; canPlay: boolean };
type TStorySummary = { id: string; name: string };

const storyPath = (storyId: string) => `/api/stories/${encodeURIComponent(storyId)}`;

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

export const getStoryAccess = async (storyId: string): Promise<TStoryAccess> => {
    const access: TStoryAccess = await (await check(await fetch(`${storyPath(storyId)}/access`))).json();
    return access;
};

export const getStoryName = async (storyId: string): Promise<string> => {
    const stories: TStorySummary[] = await (await check(await fetch('/api/stories'))).json();
    return stories.find((s) => s.id === storyId)?.name ?? storyId;
};

export const login = async (storyId: string, password: string): Promise<void> => {
    await check(
        await fetch(`${storyPath(storyId)}/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
        })
    );
};
