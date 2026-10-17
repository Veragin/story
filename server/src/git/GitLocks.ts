import { Injectable } from '@nestjs/common';

// one git command per story at a time: two would race for .git/index.lock
@Injectable()
export class GitLocks {
    private readonly tails = new Map<string, Promise<void>>();

    async run<T>(storyId: string, fn: () => Promise<T>): Promise<T> {
        const previous = this.tails.get(storyId) ?? Promise.resolve();
        let release = () => {};
        const tail = new Promise<void>((resolve) => {
            release = resolve;
        });
        this.tails.set(storyId, tail);
        try {
            await previous;
            return await fn();
        } finally {
            release();
            if (this.tails.get(storyId) === tail) this.tails.delete(storyId);
        }
    }
}
