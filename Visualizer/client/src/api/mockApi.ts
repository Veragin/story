import {
    isCode,
    isValueRecord,
    type TChangeEvent,
    type TChapterDto,
    type TChapterLayoutDto,
    type TChapterPassagesDto,
    type TCharacterDto,
    type TEntityDto,
    type TEntityDtoByKind,
    type TEntityKind,
    type TImageDto,
    type TImageOwner,
    type TItemDto,
    type TLocationDto,
    type TMapDto,
    type TNpcDto,
    type TPassageDto,
    type TPassageEdgeDto,
    type TProjectDto,
    type TSourceDto,
    type TSourceOwner,
    type TStoryInfoDto,
    type TTimelineLayoutDto,
    type TTriggerDto,
    type TValue,
    type TValueRecord,
    type TVersion,
} from '@story/visualizer-protocol';
import { clone, fail, notFound } from './mockHelpers';
import type { ApiEvents } from './events';
import { createMockSeed, type TMockSeed } from './mockData';
import { type TMockHolder } from './mockInstances';
import { createMockStructureApi } from './mockStructureApi';
import type { TVisualizerApi } from './types';

export type TMockApiOptions = {
    seed?: TMockSeed;
    events?: ApiEvents;
    latencyMs?: number;
};

export type TMockApi = TVisualizerApi & {
    simulateExternalChange(kind: TChangeEvent['kind'], id: string): void;
    reset(): void;
};

const ENTITY_REF_NAMES: Record<TEntityKind, string> = {
    characters: 'TCharacter',
    npcs: 'TNpc',
    locations: 'TLocation',
    items: 'TItem',
};

const PASSAGE_ID_RE = /['"`]([A-Za-z0-9_]+-[A-Za-z0-9_]+-[A-Za-z0-9_]*)['"`]/g;

const MOCK_STORY: TStoryInfoDto = {
    id: 'example',
    name: 'Example (mock)',
    author: '',
    description: 'The in-memory sample story of the mock api.',
    mapSize: { width: 40, height: 30 },
    public: true,
    version: 'mock-story',
};

export const displayText = (value: TValue | undefined, fallback: string): string => {
    if (typeof value === 'string') return value || fallback;
    if (isCode(value)) {
        const m = /^_\(\s*(['"`])(.*)\1\s*\)$/s.exec(value.code.trim());
        return m?.[2] || fallback;
    }
    return fallback;
};

export const extractEdges = (
    passages: TPassageDto[],
    known: ReadonlySet<string> = new Set(passages.map((p) => p.passageId))
): TPassageEdgeDto[] => {
    const edges: TPassageEdgeDto[] = [];
    const add = (from: string, value: unknown, kind: TPassageEdgeDto['kind'], underCode = false) => {
        if (typeof value === 'string') {
            edges.push({ from, to: value, kind, conditional: underCode, resolved: known.has(value) });
        } else if (isCode(value)) {
            for (const [, to] of value.code.matchAll(PASSAGE_ID_RE)) {
                edges.push({ from, to, kind, conditional: true, resolved: known.has(to) });
            }
        }
    };
    for (const p of passages) {
        if (p.type === 'screen') {
            if (isCode(p.body)) {
                add(p.passageId, p.body, 'link');
                continue;
            }
            for (const item of p.body) {
                const conditional = item.condition !== undefined && item.condition.code.trim() !== 'true';
                if (item.redirect !== undefined) add(p.passageId, item.redirect, 'redirect', conditional);
                if (item.links === undefined) continue;
                if (isCode(item.links)) {
                    add(p.passageId, item.links, 'link');
                    continue;
                }
                for (const link of item.links) add(p.passageId, link.passageId, 'link', conditional);
            }
        } else if (p.nextPassageId !== undefined) {
            add(p.passageId, p.nextPassageId, 'next');
        }
    }
    return edges;
};

export const createMockApi = ({ seed, events, latencyMs = 0 }: TMockApiOptions = {}): TMockApi => {
    let counter = 0;
    const nextVersion = (): TVersion => `mock-${++counter}`;

    let chapters = new Map<string, TChapterDto>();
    let passages = new Map<string, TPassageDto>();
    let triggers = new Map<string, TTriggerDto>();
    let entities: { [K in TEntityKind]: Map<string, TEntityDtoByKind[K]> };
    let maps = new Map<string, TMapDto>();
    let timelineLayout: TTimelineLayoutDto;
    let chapterLayouts = new Map<string, TChapterLayoutDto>();
    let images = new Map<string, TImageDto>();
    let sources = new Map<string, TSourceDto>();

    const load = (s: TMockSeed) => {
        const withVersion = <T>(x: T) => ({ ...clone(x), version: nextVersion() });
        chapters = new Map(s.chapters.map((c) => [c.chapterId, withVersion(c)]));
        passages = new Map(s.passages.map((p) => [p.passageId, withVersion(p)]));
        triggers = new Map(s.triggers.map((t) => [t.triggerId, withVersion(t)]));
        entities = {
            characters: new Map(s.characters.map((e) => [e.id, withVersion(e)])),
            npcs: new Map(s.npcs.map((e) => [e.id, withVersion(e)])),
            locations: new Map(s.locations.map((e) => [e.id, withVersion(e)])),
            items: new Map(s.items.map((e) => [e.id, withVersion(e)])),
        };
        maps = new Map(s.maps.map((m) => [m.mapId, withVersion(m)]));
        timelineLayout = s.timelineLayout ? withVersion(s.timelineLayout) : { chapters: {}, triggers: {}, version: '' };
        chapterLayouts = new Map(
            Object.entries(s.chapterLayouts).map(([id, l]) => [id, { ...withVersion(l), chapterId: id }])
        );
        images = new Map();
        sources = new Map();
        structureApi.load(s);
        refreshDerived();
    };

    const refreshDerived = () => {
        for (const chapter of chapters.values()) {
            const byCharacter = new Map<string, string[]>(chapter.characters.map((c) => [c.characterId, []]));
            for (const p of passages.values()) {
                if (p.chapterId !== chapter.chapterId) continue;
                byCharacter.set(p.characterId, [...(byCharacter.get(p.characterId) ?? []), p.passageId]);
            }
            chapter.characters = [...byCharacter.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([characterId, ids]) => ({ characterId, passageCount: ids.length, passageIds: ids.sort() }));
        }
    };

    const emit = (event: TChangeEvent, { markSaved = true } = {}) => {
        if (!events) return;
        if (event.version && markSaved) events.markSaved(event.version);
        setTimeout(() => events.dispatch(event), 0);
    };

    const delay = async () => {
        if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
    };
    // deep copy so callers never alias state
    const reply = async <T>(fn: () => T): Promise<T> => {
        await delay();
        return clone(fn());
    };

    const checkVersion = (current: { version: TVersion } | undefined, version: TVersion) => {
        const actual = current?.version ?? '';
        if (actual !== version) fail(409, { error: 'stale', message: 'Changed on disk', current: current ?? null });
    };

    const get = <T>(map: Map<string, T>, id: string, what: string): T => map.get(id) ?? notFound(`${what} "${id}"`);

    const references = (passageIds: Set<string>, exceptFolder?: (p: TPassageDto) => boolean) =>
        extractEdges([...passages.values()])
            .filter((e) => passageIds.has(e.to) && !passageIds.has(e.from))
            .filter((e) => {
                const from = passages.get(e.from);
                return !exceptFolder || !from || !exceptFolder(from);
            })
            .map((e) => ({ file: passages.get(e.from)?.file ?? '', line: 1, passageId: e.from }));

    const imageOf = (owner: TImageOwner, id: string): TImageDto => {
        const found =
            images.get(`${owner}/${id}`) ??
            (owner === 'passages'
                ? get(passages, id, 'passage')
                : get(entities[owner] as Map<string, TEntityDto>, id, `${owner}/${id}`));
        if ('url' in found) return found;
        return { owner, id, file: found.file.replace(/\.ts$/, '.png'), version: '', url: null };
    };

    const sourceOf = (owner: TSourceOwner, id: string): TSourceDto => {
        const saved = sources.get(`${owner}/${id}`);
        if (saved) return saved;
        const { version, ...dto } = owner === 'chapter' ? get(chapters, id, 'chapter') : get(passages, id, 'passage');
        const name = `${owner === 'chapter' ? id : id.split('-').pop()}${owner === 'chapter' ? 'Chapter' : 'Passage'}`;
        const text = `// mock api: this is the ${owner} as JSON, not its real source\nexport const ${name} = ${JSON.stringify(dto, null, 4)};\n`;
        return { file: dto.file, text, version: `src-${version}` };
    };

    const writeEntity = (kind: TEntityKind, id: string, patch: Record<string, unknown>) => {
        const map = entities[kind] as Map<string, TEntityDto>;
        const current = map.get(id);
        if (!current) return;
        const next = { ...current, ...patch, version: nextVersion() } as TEntityDto;
        map.set(id, next);
        emit({ kind: 'entity', id: `${kind}/${id}`, version: next.version, op: 'updated' }, { markSaved: false });
    };

    const entityHolder = (
        e: TEntityDto,
        typeName: string,
        path: string,
        values: TValueRecord,
        write: (values: TValueRecord) => Record<string, unknown>,
        openProps = false
    ): TMockHolder => ({
        typeName,
        file: e.file,
        resource: { kind: 'entity', id: `${e.kind}/${e.id}` },
        path,
        values,
        openProps,
        write: (next) => writeEntity(e.kind, e.id, write(next)),
    });

    const initHolder = (e: TCharacterDto | TNpcDto, typeName: string): TMockHolder[] =>
        isValueRecord(e.init) ? [entityHolder(e, typeName, 'init', e.init, (init) => ({ init }))] : [];

    const userFieldsHolder = (e: TEntityDto, typeName: string): TMockHolder =>
        entityHolder(e, typeName, '', ('userFields' in e && e.userFields) || {}, (userFields) => ({ userFields }));

    const locationHolder = (e: TLocationDto): TMockHolder =>
        entityHolder(
            e,
            'TLocation',
            '',
            { ...e.userFields, ...(Array.isArray(e.sublocations) ? { sublocations: e.sublocations } : {}) },
            ({ sublocations, ...userFields }) => ({ userFields, sublocations })
        );

    const itemHolder = (e: TItemDto): TMockHolder =>
        entityHolder(
            e,
            'TItemInfo',
            '',
            { name: e.name, type: e.type, ...e.props },
            ({ name, type, ...props }) => ({ name, type, props }),
            true
        );

    const chapterHolder = (c: TChapterDto): TMockHolder => ({
        typeName: 'TChapter',
        file: c.file,
        resource: { kind: 'chapter', id: c.chapterId },
        path: '',
        values: typeof c.location === 'string' ? { location: c.location } : {},
        write: ({ location }) => {
            if (typeof location !== 'string') return;
            const next = { ...c, location, version: nextVersion() };
            chapters.set(c.chapterId, next);
            emit(
                { kind: 'chapter', id: c.chapterId, version: next.version, op: 'updated', chapterId: c.chapterId },
                { markSaved: false }
            );
        },
    });

    const holders = (): TMockHolder[] => [
        ...[...entities.characters.values()].flatMap((e) => [
            userFieldsHolder(e, 'TCharacter'),
            ...initHolder(e, 'TCharacterData'),
        ]),
        ...[...entities.npcs.values()].flatMap((e) => [userFieldsHolder(e, 'TNpc'), ...initHolder(e, 'TNpcData')]),
        ...[...entities.locations.values()].map(locationHolder),
        ...[...entities.items.values()].map(itemHolder),
        ...[...chapters.values()].map(chapterHolder),
    ];

    const structureApi = createMockStructureApi({
        nextVersion,
        emit: (event, own) => emit(event, { markSaved: own }),
        reply,
        checkVersion,
        holders,
        builtInIds: (target) =>
            target.source === 'chapters' ? [...chapters.keys()] : [...entities[target.kind].keys()],
    });

    const deletePlan = (kind: TEntityKind, id: string) => {
        const remaining = [...entities[kind].keys()].filter((key) => key !== id);
        return structureApi.referencesTo(ENTITY_REF_NAMES[kind], id, remaining, `${kind}/${id}`);
    };

    load(seed ?? createMockSeed());

    const api: TMockApi = {
        health: () =>
            reply(() => ({
                ok: true as const,
                service: '@story/visualizer-server' as const,
                storiesRoot: '(mock)',
                watching: false,
            })),
        login: () => reply(() => undefined),
        getStoryInfo: () => reply(() => MOCK_STORY),

        getProject: () =>
            reply(
                (): TProjectDto => ({
                    version: `mock-project-${counter}`,
                    chapters: [...chapters.values()].map((c) => ({
                        id: c.chapterId,
                        name: displayText(c.title, c.chapterId),
                        timeRange: c.timeRange,
                        characterIds: c.characters.map((ch) => ch.characterId),
                        childIds: isCode(c.children)
                            ? []
                            : c.children.flatMap((child) =>
                                  typeof child.chapterId === 'string' ? [child.chapterId] : []
                              ),
                        triggerIds: c.triggerIds.filter((t): t is string => typeof t === 'string'),
                    })),
                    characters: [...entities.characters.values()].map((e) => ({
                        id: e.id,
                        name: displayText(e.name, e.id),
                    })),
                    npcs: [...entities.npcs.values()].map((e) => ({ id: e.id, name: displayText(e.name, e.id) })),
                    locations: [...entities.locations.values()].map((e) => ({
                        id: e.id,
                        name: displayText(e.name, e.id),
                    })),
                    items: [...entities.items.values()].map((e) => ({
                        id: e.id,
                        name: displayText(e.name, e.id),
                        type: e.type,
                    })),
                    triggers: [...triggers.values()].map((t) => ({
                        id: t.triggerId,
                        name: displayText(t.name, t.triggerId),
                        chapterId: t.chapterId,
                    })),
                })
            ),

        createChapter: (body) =>
            reply(() => {
                if (chapters.has(body.chapterId))
                    fail(409, { error: 'exists', message: `Chapter "${body.chapterId}" exists` });
                const chapter: TChapterDto = {
                    chapterId: body.chapterId,
                    version: nextVersion(),
                    file: `data/chapters/${body.chapterId}/${body.chapterId}.chapter.ts`,
                    exportName: `${body.chapterId}Chapter`,
                    title: body.title,
                    description: body.description ?? '',
                    timeRange: body.timeRange,
                    location: body.location,
                    children: [],
                    triggerIds: [],
                    init: {},
                    characters: [],
                };
                chapters.set(chapter.chapterId, chapter);
                emit({ kind: 'chapter', id: chapter.chapterId, version: chapter.version, op: 'created' });
                return chapter;
            }),
        getChapter: (chapterId) => reply(() => get(chapters, chapterId, 'chapter')),
        updateChapter: (chapterId, { version, ...patch }) =>
            reply(() => {
                const current = get(chapters, chapterId, 'chapter');
                checkVersion(current, version);
                const next: TChapterDto = {
                    ...current,
                    ...patch,
                    characters: current.characters,
                    version: nextVersion(),
                };
                chapters.set(chapterId, next);
                emit({ kind: 'chapter', id: chapterId, version: next.version, op: 'updated', chapterId });
                return next;
            }),
        deleteChapter: (chapterId, { version }) =>
            reply(() => {
                const current = get(chapters, chapterId, 'chapter');
                checkVersion(current, version);
                const own = new Set(current.characters.flatMap((c) => c.passageIds));
                const refs = references(own);
                if (refs.length > 0) fail(409, { error: 'referenced', references: refs });
                chapters.delete(chapterId);
                for (const id of own) passages.delete(id);
                emit({ kind: 'chapter', id: chapterId, version: null, op: 'deleted', chapterId });
                return { ok: true as const };
            }),
        addChapterCharacter: (chapterId, { characterId, startPassageLocalId = 'intro' }) =>
            reply(() => {
                const chapter = get(chapters, chapterId, 'chapter');
                get(entities.characters, characterId, 'character');
                if (chapter.characters.some((c) => c.characterId === characterId)) {
                    fail(409, { error: 'exists', message: `${characterId} is already in ${chapterId}` });
                }
                const passageId = `${chapterId}-${characterId}-${startPassageLocalId}`;
                passages.set(passageId, {
                    passageId,
                    chapterId,
                    characterId,
                    localId: startPassageLocalId,
                    file: `data/chapters/${chapterId}/${characterId}.passages/${startPassageLocalId}.ts`,
                    exportName: `${startPassageLocalId}Passage`,
                    params: [],
                    version: nextVersion(),
                    type: 'screen',
                    title: startPassageLocalId,
                    image: '',
                    body: [{ condition: { code: 'true' }, text: '', links: [] }],
                });
                chapter.characters.push({ characterId, passageCount: 0, passageIds: [] });
                chapter.version = nextVersion();
                refreshDerived();
                emit({ kind: 'chapter', id: chapterId, version: chapter.version, op: 'updated', chapterId });
                return chapter;
            }),
        removeChapterCharacter: (chapterId, characterId, { version }) =>
            reply(() => {
                const chapter = get(chapters, chapterId, 'chapter');
                checkVersion(chapter, version);
                const entry = chapter.characters.find((c) => c.characterId === characterId);
                if (!entry) notFound(`character "${characterId}" in chapter "${chapterId}"`);
                const own = new Set(entry?.passageIds);
                const refs = references(own);
                if (refs.length > 0) fail(409, { error: 'referenced', references: refs });
                for (const id of own) passages.delete(id);
                chapter.characters = chapter.characters.filter((c) => c.characterId !== characterId);
                chapter.version = nextVersion();
                emit({ kind: 'chapter', id: chapterId, version: chapter.version, op: 'updated', chapterId });
                return chapter;
            }),

        listChapterPassages: (chapterId) =>
            reply((): TChapterPassagesDto => {
                get(chapters, chapterId, 'chapter');
                const list = [...passages.values()].filter((p) => p.chapterId === chapterId);
                return { chapterId, passages: list, edges: extractEdges(list, new Set(passages.keys())) };
            }),
        createPassage: (chapterId, { characterId, localId, type, title }) =>
            reply(() => {
                const chapter = get(chapters, chapterId, 'chapter');
                if (!chapter.characters.some((c) => c.characterId === characterId)) {
                    fail(400, {
                        error: 'bad_request',
                        message: `${characterId} is not in ${chapterId}; add the character first`,
                    });
                }
                if (localId.includes('-'))
                    fail(400, { error: 'bad_request', message: 'Passage ids must not contain "-"' });
                const passageId = `${chapterId}-${characterId}-${localId}`;
                if (passages.has(passageId)) fail(409, { error: 'exists', message: `Passage "${passageId}" exists` });
                const base = {
                    passageId,
                    chapterId,
                    characterId,
                    localId,
                    file: `data/chapters/${chapterId}/${characterId}.passages/${localId}.ts`,
                    exportName: `${localId}Passage`,
                    params: [],
                    version: nextVersion(),
                };
                const passage: TPassageDto =
                    type === 'screen'
                        ? {
                              ...base,
                              type,
                              title: title ?? localId,
                              image: '',
                              body: [{ condition: { code: 'true' }, text: '', links: [] }],
                          }
                        : type === 'linear'
                          ? { ...base, type, description: title ?? '' }
                          : { ...base, type, nextPassageId: '' };
                passages.set(passageId, passage);
                refreshDerived();
                emit({ kind: 'passage', id: passageId, version: passage.version, op: 'created', chapterId });
                return passage;
            }),
        getPassage: (passageId) => reply(() => get(passages, passageId, 'passage')),
        updatePassage: (passageId, { version, ...patch }) =>
            reply(() => {
                const current = get(passages, passageId, 'passage');
                checkVersion(current, version);
                const next = { ...current, ...patch, version: nextVersion() } as TPassageDto;
                // `null` removes an optional field (`execute`, `nextPassageId`), as on the server
                for (const [key, value] of Object.entries(patch)) {
                    if (value === null) delete (next as Record<string, unknown>)[key];
                }
                passages.set(passageId, next);
                emit({
                    kind: 'passage',
                    id: passageId,
                    version: next.version,
                    op: 'updated',
                    chapterId: next.chapterId,
                });
                return next;
            }),
        deletePassage: (passageId, { version }) =>
            reply(() => {
                const current = get(passages, passageId, 'passage');
                checkVersion(current, version);
                const refs = references(new Set([passageId]));
                if (refs.length > 0) fail(409, { error: 'referenced', references: refs });
                passages.delete(passageId);
                refreshDerived();
                emit({ kind: 'passage', id: passageId, version: null, op: 'deleted', chapterId: current.chapterId });
                return { ok: true as const };
            }),

        ...structureApi.routes,

        getSource: (owner, id) => reply(() => sourceOf(owner, id)),
        updateSource: (owner, id, { version, text }) =>
            reply(() => {
                checkVersion(sourceOf(owner, id), version);
                const next: TSourceDto = { file: sourceOf(owner, id).file, text, version: nextVersion() };
                sources.set(`${owner}/${id}`, next);
                const chapterId = owner === 'chapter' ? id : get(passages, id, 'passage').chapterId;
                emit({ kind: owner, id, version: next.version, op: 'updated', chapterId }, { markSaved: false });
                return next;
            }),

        createTrigger: (chapterId, body) =>
            reply(() => {
                const chapter = get(chapters, chapterId, 'chapter');
                if (triggers.has(body.triggerId))
                    fail(409, { error: 'exists', message: `Trigger "${body.triggerId}" exists` });
                const trigger: TTriggerDto = {
                    triggerId: body.triggerId,
                    chapterId,
                    file: `data/chapters/${chapterId}/triggers.ts`,
                    exportName: `${body.triggerId}Trigger`,
                    version: nextVersion(),
                    name: body.name,
                    description: body.description ?? '',
                    time: body.time,
                    condition: { code: '() => true' },
                    action: { code: '() => {}' },
                };
                triggers.set(trigger.triggerId, trigger);
                chapter.triggerIds.push(trigger.triggerId);
                chapter.version = nextVersion();
                emit({ kind: 'trigger', id: trigger.triggerId, version: trigger.version, op: 'created', chapterId });
                return trigger;
            }),
        getTrigger: (triggerId) => reply(() => get(triggers, triggerId, 'trigger')),
        updateTrigger: (triggerId, { version, ...patch }) =>
            reply(() => {
                const current = get(triggers, triggerId, 'trigger');
                checkVersion(current, version);
                const next = { ...current, ...patch, version: nextVersion() };
                triggers.set(triggerId, next);
                emit({
                    kind: 'trigger',
                    id: triggerId,
                    version: next.version,
                    op: 'updated',
                    chapterId: next.chapterId,
                });
                return next;
            }),
        deleteTrigger: (triggerId, { version }) =>
            reply(() => {
                const current = get(triggers, triggerId, 'trigger');
                checkVersion(current, version);
                triggers.delete(triggerId);
                const chapter = chapters.get(current.chapterId);
                if (chapter) {
                    chapter.triggerIds = chapter.triggerIds.filter((t) => t !== triggerId);
                    chapter.version = nextVersion();
                }
                emit({ kind: 'trigger', id: triggerId, version: null, op: 'deleted', chapterId: current.chapterId });
                return { ok: true as const };
            }),

        listEntities: <K extends TEntityKind>(kind: K) =>
            reply(() => ({ kind, entities: [...(entities[kind] as Map<string, TEntityDtoByKind[K]>).values()] })),
        createEntity: <K extends TEntityKind>(kind: K, body: { id: string } & Record<string, unknown>) =>
            reply(() => {
                const map = entities[kind] as Map<string, TEntityDto>;
                if (map.has(body.id)) fail(409, { error: 'exists', message: `${kind}/${body.id} exists` });
                const base = { kind, id: body.id, version: nextVersion(), file: `data/${kind}/${body.id}.ts` };
                const defaults: Record<TEntityKind, object> = {
                    characters: { name: body.id, init: { health: 100, inventory: [] } },
                    npcs: {
                        name: body.id,
                        description: '',
                        init: { inventory: [], location: undefined, isDead: false },
                    },
                    locations: { name: body.id, description: '', localCharacters: [], init: {} },
                    items: { name: body.id, type: 'value', source: 'itemInfo' },
                };
                const given = (value: unknown) => (isValueRecord(value) ? value : {});
                // as on the server: defaults for the author's required fields
                const own =
                    kind === 'items'
                        ? { props: { ...structureApi.userDefaults('TItemInfo'), ...given(body.props) } }
                        : {
                              userFields: {
                                  ...structureApi.userDefaults(ENTITY_REF_NAMES[kind]),
                                  ...given(body.userFields),
                              },
                          };
                const entity = { ...defaults[kind], ...body, ...own, ...base } as unknown as TEntityDtoByKind[K];
                map.set(body.id, entity);
                emit({ kind: 'entity', id: `${kind}/${body.id}`, version: entity.version, op: 'created' });
                return entity;
            }),
        getEntity: <K extends TEntityKind>(kind: K, id: string) =>
            reply(() => get(entities[kind] as Map<string, TEntityDtoByKind[K]>, id, `${kind}/${id}`)),
        updateEntity: <K extends TEntityKind>(kind: K, id: string, { version, ...patch }: { version: TVersion }) =>
            reply(() => {
                const map = entities[kind] as Map<string, TEntityDtoByKind[K]>;
                const current = get(map, id, `${kind}/${id}`);
                checkVersion(current, version);
                const next = { ...current, ...patch, version: nextVersion() } as TEntityDtoByKind[K];
                // as on the server: `null` removes an optional field, user fields are merged per key
                const record = next as Record<string, unknown>;
                for (const [key, value] of Object.entries(patch)) {
                    if (value === null) delete record[key];
                }
                if ('userFields' in patch && typeof patch.userFields === 'object' && patch.userFields) {
                    const merged = { ...(current as { userFields?: object }).userFields, ...patch.userFields };
                    record.userFields = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null));
                }
                map.set(id, next);
                emit({ kind: 'entity', id: `${kind}/${id}`, version: next.version, op: 'updated' });
                return next;
            }),
        deleteEntity: (kind, id, { version }) =>
            reply(() => {
                const map = entities[kind] as Map<string, TEntityDto>;
                const current = get(map, id, `${kind}/${id}`);
                checkVersion(current, version);
                const plan = deletePlan(kind, id);
                if (plan.blocking.length > 0) fail(409, { error: 'referenced', references: plan.blocking });
                map.delete(id);
                emit({ kind: 'entity', id: `${kind}/${id}`, version: null, op: 'deleted' });
                plan.apply();
                return { ok: true as const, cleared: plan.cleared };
            }),
        getEntityReferences: (kind, id) =>
            reply(() => {
                get(entities[kind] as Map<string, TEntityDto>, id, `${kind}/${id}`);
                const { cleared, blocking } = deletePlan(kind, id);
                return { cleared, blocking };
            }),

        getImage: (owner, id) => reply(() => imageOf(owner, id)),
        uploadImage: (owner, id, { version, data }) =>
            reply(() => {
                const current = imageOf(owner, id);
                checkVersion(current, version);
                // no change event, like the server: an image is not a resource of `dto/events.ts`
                const next: TImageDto = { ...current, version: nextVersion(), url: `data:image/png;base64,${data}` };
                images.set(`${owner}/${id}`, next);
                return next;
            }),

        getMap: (mapId) => reply(() => get(maps, mapId, `map "${mapId}"`)),
        updateMap: (mapId, { version, ...file }) =>
            reply(() => {
                checkVersion(maps.get(mapId), version);
                const next: TMapDto = { ...file, mapId, version: nextVersion() };
                maps.set(mapId, next);
                emit({ kind: 'map', id: mapId, version: next.version, op: version === '' ? 'created' : 'updated' });
                return next;
            }),

        getTimelineLayout: () => reply(() => timelineLayout),
        updateTimelineLayout: ({ version, ...file }) =>
            reply(() => {
                checkVersion(timelineLayout, version);
                timelineLayout = { ...file, version: nextVersion() };
                emit({ kind: 'layout', id: 'timeline', version: timelineLayout.version, op: 'updated' });
                return timelineLayout;
            }),
        getChapterLayout: (chapterId) =>
            reply(() => {
                get(chapters, chapterId, 'chapter');
                return chapterLayouts.get(chapterId) ?? { chapterId, passages: {}, version: '' };
            }),
        updateChapterLayout: (chapterId, { version, ...file }) =>
            reply(() => {
                get(chapters, chapterId, 'chapter');
                checkVersion(chapterLayouts.get(chapterId), version);
                const next: TChapterLayoutDto = { ...file, chapterId, version: nextVersion() };
                chapterLayouts.set(chapterId, next);
                emit({ kind: 'layout', id: `chapters/${chapterId}`, version: next.version, op: 'updated', chapterId });
                return next;
            }),

        simulateExternalChange: (kind, id) => {
            const bump = <T extends { version: TVersion }>(x: T | undefined) => {
                if (x) x.version = nextVersion();
                return x?.version ?? null;
            };
            const [entityKind, entityId] = id.split('/') as [TEntityKind, string];
            const version =
                kind === 'chapter'
                    ? bump(chapters.get(id))
                    : kind === 'passage'
                      ? bump(passages.get(id))
                      : kind === 'trigger'
                        ? bump(triggers.get(id))
                        : kind === 'entity'
                          ? bump(entities[entityKind]?.get(entityId) as TEntityDto | undefined)
                          : kind === 'map'
                            ? bump(maps.get(id))
                            : `mock-${++counter}`;
            if (events) setTimeout(() => events.dispatch({ kind, id, version, op: 'updated' }), 0);
        },
        reset: () => load(seed ?? createMockSeed()),
    };
    return api;
};
