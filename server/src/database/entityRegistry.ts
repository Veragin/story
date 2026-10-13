import { Story } from '../stories/Story';

// explicit classes, not a glob: TypeORM loads globs with native import(), which bypasses Vitest's transform
export const ENTITIES: (new () => object)[] = [Story];
