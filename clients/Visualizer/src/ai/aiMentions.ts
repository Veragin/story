import type { TEntityKind, TProjectDto } from '@story/protocol';
import {
    formatMention,
    MENTION_CLASSES as MENTION_CLASS_NAMES,
    type TMentionClass,
    type TMentionNameOf,
} from '@story/shared';
import type { EntityStore } from '../stores/EntityStore';
import type { TSuggestion } from './aiToken';

export { formatMention, type TMentionClass };

export type TMentionKind = TEntityKind | 'chapters' | 'passages';

export type TMentionClassInfo = {
    name: TMentionClass;
    kind: TMentionKind;
    label: () => string;
};

export type TPassageEntry = {
    id: string;
    title: string;
    chapterId: string;
};

export type TPassageSource = {
    readonly passages: readonly TPassageEntry[];
    readonly loading: boolean;
    readonly inChapter: boolean;
    load: () => void;
};

export type TMentionSources = {
    project: TProjectDto | null;
    passages: readonly TPassageEntry[];
};

export type TMentionStores = {
    entities: Pick<EntityStore, 'project' | 'start'>;
    passages: TPassageSource;
};

export type TMentionResult = {
    mentionClass: TMentionClass | null;
    matches: TSuggestion[];
};

type TMentionEntry = { id: string; name: string; detail?: string };

const INFO_OF_CLASS: { [C in TMentionClass]: { kind: `${C}s`; label: () => string } } = {
    character: { kind: 'characters', label: () => _('Characters') },
    npc: { kind: 'npcs', label: () => _('NPCs') },
    location: { kind: 'locations', label: () => _('Locations') },
    item: { kind: 'items', label: () => _('Items') },
    chapter: { kind: 'chapters', label: () => _('Chapters') },
    passage: { kind: 'passages', label: () => _('Passages') },
};

export const MENTION_CLASSES: readonly TMentionClassInfo[] = MENTION_CLASS_NAMES.map((name) => ({
    name,
    ...INFO_OF_CLASS[name],
}));

export const splitMention = (query: string): { className: string; entryQuery: string | null } => {
    const colon = query.indexOf(':');
    return colon < 0
        ? { className: query, entryQuery: null }
        : { className: query.slice(0, colon), entryQuery: query.slice(colon + 1) };
};

const namedDetail = (id: string, name: string, extra?: string) =>
    [name === id ? null : name, extra].filter((part) => part).join(' · ') || undefined;

const entriesOf = (kind: TMentionKind, { project, passages }: TMentionSources): TMentionEntry[] => {
    switch (kind) {
        case 'items':
            return (project?.items ?? []).map(({ id, name, type }) => ({ id, name, detail: namedDetail(id, name, type) }));
        case 'passages':
            return passages.map(({ id, title }) => ({ id, name: title, detail: namedDetail(id, title) }));
        default:
            return (project?.[kind] ?? []).map(({ id, name }) => ({ id, name, detail: namedDetail(id, name) }));
    }
};

const classSuggestions = (className: string): TSuggestion[] => {
    const typed = className.toLowerCase();
    return MENTION_CLASSES.filter(({ name }) => name.startsWith(typed)).map(({ name, label }) => {
        const value = `@${name}:`;
        return { key: value, label: value, detail: label(), value, continues: true };
    });
};

const entrySuggestions = (info: TMentionClassInfo, entryQuery: string, sources: TMentionSources): TSuggestion[] => {
    const typed = entryQuery.toLowerCase();
    return entriesOf(info.kind, sources)
        .filter(({ id, name }) => id.toLowerCase().includes(typed) || name.toLowerCase().includes(typed))
        .map(({ id, detail }) => {
            const value = formatMention(info.name, id);
            return { key: value, label: id, detail, value, continues: false };
        });
};

export const mentionSuggestions = (query: string, sources: TMentionSources): TMentionResult => {
    const { className, entryQuery } = splitMention(query);
    if (entryQuery === null) return { mentionClass: null, matches: classSuggestions(className) };
    const info = MENTION_CLASSES.find(({ name }) => name === className.toLowerCase());
    if (!info) return { mentionClass: null, matches: [] };
    return { mentionClass: info.name, matches: entrySuggestions(info, entryQuery, sources) };
};

export const mentionNameOf =
    (sources: TMentionSources): TMentionNameOf =>
    (mentionClass, id) =>
        entriesOf(INFO_OF_CLASS[mentionClass].kind, sources).find((entry) => entry.id === id)?.name;
