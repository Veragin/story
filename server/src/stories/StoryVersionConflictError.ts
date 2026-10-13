export class StoryVersionConflictError extends Error {
    readonly storyId: string;

    constructor(storyId: string) {
        super(`Story "${storyId}" was changed by someone else`);
        this.name = 'StoryVersionConflictError';
        this.storyId = storyId;
    }
}
