import { eventIds, type TChangeEvent } from '@story/visualizer-protocol';
import { isTempFile } from '../json/atomicWrite';

// primary: the file *is* the resource, so deleting it deletes the resource
export type TResourceRef = Omit<TChangeEvent, 'version' | 'op'> & { primary: boolean };

const idFromEntityFile = (base: string) => base.charAt(0).toLowerCase() + base.slice(1);

export const localIdFromPassageFile = (file: string) => file.split('.')[0];

const STRUCTURE: TResourceRef = { kind: 'structure', id: eventIds.structure, primary: false };

const declaresStructure = (parts: string[]) =>
    parts[parts.length - 1].endsWith('.ts') &&
    (parts[0] === 'types' ||
        (parts[0] === 'data' && parts.length === 3 && (parts[1] === 'items' || parts[1] === 'catalogs')));

// a file holding several resources maps to a wildcard: telling which one changed would need a parse
const pathToResource = (relPath: string): TResourceRef | null => {
    const parts = relPath.split('/');
    const file = parts[parts.length - 1];

    if (parts[0] === 'types') {
        return file.endsWith('.ts') ? { kind: 'project', id: eventIds.project, primary: false } : null;
    }
    if (parts[0] !== 'data') return null;

    if (parts.length === 2) {
        return file.endsWith('.ts') ? { kind: 'project', id: eventIds.project, primary: false } : null;
    }

    const [, area] = parts;
    if (area === '__tests__' || area === 'assets') return null;

    if (area === 'chapters') {
        if (parts.length === 3) {
            return file === 'timeline.layout.json'
                ? { kind: 'layout', id: eventIds.timelineLayout, primary: true }
                : null;
        }
        const chapterId = parts[2];
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
            return file.endsWith('.ts') ? { kind: 'chapter', id: chapterId, chapterId, primary: false } : null;
        }
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
    if (area === 'catalogs') {
        return file.endsWith('.ts')
            ? { kind: 'catalog', id: eventIds.catalog(file.slice(0, -'.ts'.length), eventIds.wildcard), primary: false }
            : null;
    }
    if (area === 'items') {
        return file.endsWith('.ts')
            ? { kind: 'entity', id: eventIds.entity('items', eventIds.wildcard), primary: false }
            : null;
    }
    return null;
};

export const pathToResources = (relPath: string): TResourceRef[] => {
    if (isTempFile(relPath)) return [];
    const ref = pathToResource(relPath);
    return [...(ref ? [ref] : []), ...(declaresStructure(relPath.split('/')) ? [STRUCTURE] : [])];
};

export const resourceKey = (r: TResourceRef) => `${r.kind}:${r.id}:${r.chapterId ?? ''}`;
