import { HttpError } from '../../common/HttpError';

// the running generations per story, in memory
export class ImageJobs {
    private readonly running = new Map<string, Set<string>>();

    constructor(private readonly maxPerStory: number) {}

    // returns the release; 409 ai_image_busy for the same job again or a full story
    start(storyId: string, job: string): () => void {
        const jobs = this.running.get(storyId) ?? new Set<string>();
        if (jobs.has(job)) throw HttpError.of('ai_image_busy', 'This image is already being generated');
        if (jobs.size >= this.maxPerStory) {
            throw HttpError.of('ai_image_busy', `${jobs.size} images are already being generated in this story`);
        }
        jobs.add(job);
        this.running.set(storyId, jobs);
        let released = false;
        return () => {
            if (released) return;
            released = true;
            jobs.delete(job);
            if (jobs.size === 0) this.running.delete(storyId);
        };
    }
}
