import type { EventBus } from './events/EventBus';
import type { Router } from './http/router';
import type { ProjectRoot } from './project/ProjectRoot';

/** What every `routes/<resource>.ts` gets: the project on disk, the change bus, the router. */
export type TServerContext = {
    project: ProjectRoot;
    bus: EventBus;
    router: Router;
    /** Whether the file watcher is running (off in some tests). */
    watching: () => boolean;
};
