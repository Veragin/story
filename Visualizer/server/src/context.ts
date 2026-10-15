import type { TGlobalRouteName, TStoryRouteName } from '@story/visualizer-protocol';
import type { LoginLimiter } from './auth/LoginLimiter';
import type { SessionStore } from './auth/SessionStore';
import type { EventBus } from './events/EventBus';
import type { Router } from './http/router';
import type { ProjectRoot } from './project/ProjectRoot';
import type { StoryStore } from './stories/StoryStore';

export type TServerContext = {
    storyId: string;
    stories: StoryStore;
    project: ProjectRoot;
    bus: EventBus;
    router: Router<TStoryRouteName>;
    watching: () => boolean;
};

export type TGlobalContext = {
    router: Router<TGlobalRouteName>;
    stories: StoryStore;
    watch: boolean;
    sessions: SessionStore;
    loginLimiter: LoginLimiter;
    trustProxy: boolean;
    cookieSecure: boolean;
};
