import type { EventBus } from '../events/EventBus';
import type { ProjectRoot } from '../project/ProjectRoot';
import type { SourceProject } from '../project/SourceProject';

export type TServerContext = {
    storyId: string;
    project: ProjectRoot;
    sp: SourceProject;
    bus: EventBus;
    watching: () => boolean;
};
