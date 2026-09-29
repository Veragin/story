import type { TProjectDto } from '@story/visualizer-protocol';
import { version } from '../../events/version';
import { getProp } from '../ast';
import type { SourceProject } from '../SourceProject';
import { allTriggers, chapterIds, displayName } from '../story';
import { readProjectChapter } from './chapters';
import { entitySources, itemNodes } from './entities';

/**
 * `GET /project`. Its version hashes every story source file (in path order): the summary
 * depends on nearly all of them, and a hash of a few dozen small strings is cheap.
 */
export const readProject = (sp: SourceProject): TProjectDto => {
    const files = sp.storyFiles().sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));
    const entries = (kind: 'characters' | 'npcs' | 'locations') =>
        entitySources(sp, kind).map((e) => ({
            id: e.id,
            name: displayName(getProp(e.obj, 'name')?.getInitializer(), e.id),
        }));
    return {
        version: version(...files.flatMap((f) => [sp.root.rel(f.getFilePath()), f.getFullText()])),
        chapters: chapterIds(sp)
            .map((id) => readProjectChapter(sp, id))
            .filter((c): c is NonNullable<typeof c> => !!c),
        characters: entries('characters'),
        npcs: entries('npcs'),
        locations: entries('locations'),
        items: itemNodes(sp).map((n) => ({
            id: n.id,
            name: displayName(getProp(n.item, 'name')?.getInitializer(), n.id),
            type:
                getProp(n.item, 'type')
                    ?.getInitializer()
                    ?.getText()
                    .replace(/^['"`]|['"`]$/g, '') ?? '',
        })),
        triggers: allTriggers(sp).map((t) => ({
            id: t.triggerId,
            chapterId: t.chapterId,
            name: displayName(getProp(t.obj, 'name')?.getInitializer(), t.triggerId),
        })),
    };
};
