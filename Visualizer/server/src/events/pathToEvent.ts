import { eventIds, type TChangeEvent } from '@story/visualizer-protocol';
import { isTempFile } from '../json/atomicWrite';

/**
 * A resource an edited file maps to — a `TChangeEvent` without its version yet. `primary` says
 * whether the file *is* the resource (a passage file, `<ch>.chapter.ts`, an entity file, a JSON
 * store), so that deleting it deletes the resource; a secondary file (`<ch>.passages.ts`,
 * `triggers.ts`, an items file, `register.ts`) only changes it.
 */
export type TResourceRef = Omit<TChangeEvent, 'version' | 'op'> & { primary: boolean };

/**
 * `Franta.ts` → `franta`, `NobleMan.ts` → `nobleMan`: npc/character files are named after the
 * export, the id is the same word with a lower-case first letter (see `data/register.ts`).
 */
const idFromEntityFile = (base: string) => base.charAt(0).toLowerCase() + base.slice(1);

/** `cool.transition.ts` → `cool`, `visit.screen.ts` → `visit`, `intro.ts` → `intro`. */
export const localIdFromPassageFile = (file: string) => file.split('.')[0];

/**
 * Map a project-relative path (`/` separators) to the resource it backs, or `null` for files
 * that back no resource (tests, assets, temp files, anything outside `data/` and `types/`).
 *
 * The mapping follows the file layout of plan §2 "Data model". A file that holds several
 * resources maps to a wildcard (`triggers.ts` → `trigger` `*` in that chapter, an items file →
 * `entity` `items/*`), because telling which one changed would need a parse.
 */
export const pathToResource = (relPath: string): TResourceRef | null => {
    if (isTempFile(relPath)) return null;
    const parts = relPath.split('/');
    const file = parts[parts.length - 1];

    if (parts[0] === 'types') {
        return file.endsWith('.ts') ? { kind: 'project', id: eventIds.project, primary: false } : null;
    }
    if (parts[0] !== 'data') return null;

    // data/register.ts, data/TWorldState.ts, data/index.ts
    if (parts.length === 2) {
        return file.endsWith('.ts') ? { kind: 'project', id: eventIds.project, primary: false } : null;
    }

    const [, area] = parts;
    if (area === 'test' || area === 'assets') return null;

    if (area === 'chapters') {
        // data/chapters/timeline.layout.json
        if (parts.length === 3) {
            return file === 'timeline.layout.json'
                ? { kind: 'layout', id: eventIds.timelineLayout, primary: true }
                : null;
        }
        const chapterId = parts[2];
        // data/chapters/<ch>/<file>
        if (parts.length === 4) {
            if (file === `${chapterId}.chapter.ts`) {
                return { kind: 'chapter', id: chapterId, chapterId, primary: true };
            }
            if (file === `${chapterId}.layout.json`) {
                return { kind: 'layout', id: eventIds.chapterLayout(chapterId), chapterId, primary: true };
            }
            if (file === 'triggers.ts') {
                return { kind: 'trigger', id: eventIds.wildcard, chapterId, primary: false };
            }
            // `<ch>.passages.ts` and any other module of the chapter folder
            return file.endsWith('.ts') ? { kind: 'chapter', id: chapterId, chapterId, primary: false } : null;
        }
        // data/chapters/<ch>/<character>.passages/<local>[.<suffix>].ts
        if (parts.length === 5 && parts[3].endsWith('.passages') && file.endsWith('.ts')) {
            const characterId = parts[3].slice(0, -'.passages'.length);
            return {
                kind: 'passage',
                id: `${chapterId}-${characterId}-${localIdFromPassageFile(file)}`,
                chapterId,
                primary: true,
            };
        }
        return null;
    }

    if (parts.length !== 3) return null;

    if (area === 'locations') {
        if (file === 'map.json') return { kind: 'map', id: 'global', primary: true };
        if (file.endsWith('.location.ts')) {
            return {
                kind: 'entity',
                id: eventIds.entity('locations', file.slice(0, -'.location.ts'.length)),
                primary: true,
            };
        }
        return null;
    }
    if (area === 'characters' || area === 'npcs') {
        return file.endsWith('.ts')
            ? { kind: 'entity', id: eventIds.entity(area, idFromEntityFile(file.slice(0, -3))), primary: true }
            : null;
    }
    if (area === 'items') {
        return file.endsWith('.ts')
            ? { kind: 'entity', id: eventIds.entity('items', eventIds.wildcard), primary: false }
            : null;
    }
    return null;
};

/** Stable key for deduplicating events of one batch. */
export const resourceKey = (r: TResourceRef) => `${r.kind}:${r.id}:${r.chapterId ?? ''}`;
