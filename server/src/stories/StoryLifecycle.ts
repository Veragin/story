import { Injectable } from '@nestjs/common';

export type TStoryLifecycleListener = (storyId: string) => Promise<void>;

// lives in StoriesModule so feature modules (AI) can hook story folder changes without a module cycle
@Injectable()
export class StoryLifecycle {
    private readonly folderSwapListeners: TStoryLifecycleListener[] = [];
    private readonly deleteListeners: TStoryLifecycleListener[] = [];

    onBeforeFolderSwap(listener: TStoryLifecycleListener): void {
        this.folderSwapListeners.push(listener);
    }

    onBeforeDelete(listener: TStoryLifecycleListener): void {
        this.deleteListeners.push(listener);
    }

    async beforeFolderSwap(storyId: string): Promise<void> {
        await Promise.all(this.folderSwapListeners.map((listener) => listener(storyId)));
    }

    async beforeDelete(storyId: string): Promise<void> {
        await Promise.all(this.deleteListeners.map((listener) => listener(storyId)));
    }
}
