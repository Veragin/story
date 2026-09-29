/**
 * The few Visualizer server routes SingleEngine calls (multiple stories, phase 9), same-origin
 * through the Vite `/api` proxy. Plain `fetch` rather than the protocol's typed client: a service
 * may not import another service (`@story/visualizer-protocol` is the Visualizer's). The paths
 * and shapes mirror `GLOBAL_ROUTES` in `Visualizer/protocol/src/routes.ts`.
 */

/** A non-2xx answer. `status` is what `PasswordDialog` reads (401 wrong password, 429 too many). */
export class StoryApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'StoryApiError';
    }
}

const storyPath = (storyId: string) => `/api/stories/${encodeURIComponent(storyId)}`;

const check = async (res: Response): Promise<Response> => {
    if (res.ok) return res;
    let message = `${res.status} ${res.statusText}`;
    try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
    } catch {
        // not JSON: keep the status line
    }
    throw new StoryApiError(res.status, message);
};

/** `GET /api/stories/:id/access`: `canPlay` when the story is public or this browser unlocked it. */
export const getStoryAccess = async (storyId: string): Promise<{ canEdit: boolean; canPlay: boolean }> =>
    (await check(await fetch(`${storyPath(storyId)}/access`))).json() as Promise<{
        canEdit: boolean;
        canPlay: boolean;
    }>;

/** The story's display name, from `GET /api/stories` (the list needs no password). */
export const getStoryName = async (storyId: string): Promise<string> => {
    const stories = (await (await check(await fetch('/api/stories'))).json()) as { id: string; name: string }[];
    return stories.find((s) => s.id === storyId)?.name ?? storyId;
};

/** `POST /api/stories/:id/login {password}` → `204` and the `story_session` cookie. */
export const login = async (storyId: string, password: string): Promise<void> => {
    await check(
        await fetch(`${storyPath(storyId)}/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password }),
        })
    );
};
