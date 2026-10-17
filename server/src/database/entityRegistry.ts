import { Session } from './entities/Session';
import { SessionGrant } from './entities/SessionGrant';
import { Story } from './entities/Story';
import { StoryGit } from './entities/StoryGit';

// explicit classes, not a glob: TypeORM loads globs with native import(), which bypasses Vitest's transform
export const ENTITIES: (new () => object)[] = [Story, Session, SessionGrant, StoryGit];
