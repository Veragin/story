import { makeAutoObservable, observable, runInAction } from 'mobx';
import {
    ENTITY_KINDS,
    isEntityKind,
    type TCatalogEntryDto,
    type TChangeEvent,
    type TClearedReferencesDto,
    type TCreateCatalogEntryBody,
    type TDeleteReferencesDto,
    type TCreateEntityBody,
    type TEntityDto,
    type TEntityKind,
    type TProjectDto,
    type TRefTarget,
    type TUpdateCatalogEntryBody,
    type TUpdateEntityBody,
    type TVersion,
} from '@story/visualizer-protocol';
import { errorMessage, type ApiEvents, type TVisualizerApi } from '../api';
import type { TOption } from '../components/inputs/inputTypes';
import { RefCountedSubscription } from './RefCountedSubscription';

type TEntityStoreOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
};

const kindOfEventId = (eventId: string): TEntityKind | null => {
    const kind = eventId.split('/')[0];
    return isEntityKind(kind) ? kind : null;
};

export class EntityStore {
    lists: Partial<Record<TEntityKind, TEntityDto[]>> = {};
    listLoading = false;
    listError: string | null = null;
    project: TProjectDto | null = null;
    catalogs: Record<string, TCatalogEntryDto[]> = {};

    readonly api: TVisualizerApi;
    private readonly events?: ApiEvents;
    private readonly subscription: RefCountedSubscription;
    private listTokens: Partial<Record<TEntityKind, number>> = {};

    constructor({ api, events }: TEntityStoreOptions) {
        this.api = api;
        this.events = events;
        this.subscription = new RefCountedSubscription(() => this.subscribe());
        makeAutoObservable<EntityStore, 'events' | 'subscription' | 'listTokens'>(
            this,
            {
                api: false,
                events: false,
                subscription: false,
                listTokens: false,
                // Replaced, never mutated: plain objects stay plain (the api deep-clones bodies).
                lists: observable.ref,
                project: observable.ref,
                catalogs: observable.ref,
            },
            { autoBind: true }
        );
    }

    listOf(kind: TEntityKind): TEntityDto[] {
        return this.lists[kind] ?? [];
    }

    idsOf(kind: TEntityKind): string[] {
        return this.lists[kind]?.map((e) => e.id) ?? this.project?.[kind].map((e) => e.id) ?? [];
    }

    optionsOf(target: TRefTarget): TOption[] {
        switch (target.source) {
            case 'entities': {
                const names = new Map(this.project?.[target.kind].map((e) => [e.id, e.name]));
                return this.idsOf(target.kind).map((id) => ({ id, label: names.get(id) }));
            }
            case 'chapters':
                return this.project?.chapters.map((c) => ({ id: c.id, label: c.name })) ?? [];
            case 'catalog':
                return this.catalogOf(target.catalog).map(({ id, values }) => ({
                    id,
                    label: typeof values.name === 'string' ? values.name : undefined,
                }));
        }
    }

    // Returns the release; the subscription stays while any page holds it.
    start(): () => void {
        const fresh = !this.subscription.active;
        const release = this.subscription.acquire();
        if (fresh) void (this.project ? this.refreshAll() : this.loadProject());
        return release;
    }

    async loadList(kind: TEntityKind) {
        const token = (this.listTokens[kind] ?? 0) + 1;
        this.listTokens[kind] = token;
        this.listLoading = true;
        this.listError = null;
        try {
            const { entities } = await this.api.listEntities(kind);
            runInAction(() => {
                if (this.listTokens[kind] === token) this.lists = { ...this.lists, [kind]: entities };
            });
        } catch (e) {
            runInAction(() => {
                if (this.listTokens[kind] === token) this.listError = errorMessage(e);
            });
        } finally {
            runInAction(() => {
                if (this.listTokens[kind] === token) this.listLoading = false;
            });
        }
    }

    async loadCatalog(name: string) {
        try {
            const { entries } = await this.api.listCatalogEntries(name);
            runInAction(() => {
                this.catalogs = { ...this.catalogs, [name]: entries };
            });
        } catch {
            // the ids stay unknown; a picked id is shown as outside the options
        }
    }

    ensureCatalogs(names: readonly string[]) {
        names.filter((name) => !(name in this.catalogs)).forEach((name) => void this.loadCatalog(name));
    }

    async loadProject() {
        try {
            const project = await this.api.getProject();
            runInAction(() => {
                this.project = project;
            });
        } catch {
            // pickers fall back to the lists; the page still works
        }
    }

    // after a reconnect events may have been missed
    async refreshAll() {
        const kinds = ENTITY_KINDS.filter((kind) => this.lists[kind]);
        await Promise.all([
            ...kinds.map((k) => this.loadList(k)),
            ...Object.keys(this.catalogs).map((name) => this.loadCatalog(name)),
            this.loadProject(),
        ]);
    }

    fetch(kind: TEntityKind, id: string): Promise<TEntityDto> {
        return this.api.getEntity(kind, id);
    }

    async create(kind: TEntityKind, body: TCreateEntityBody): Promise<TEntityDto> {
        const created = await this.api.createEntity(kind, body);
        runInAction(() => {
            const list = this.lists[kind];
            if (list && !list.some((e) => e.id === created.id))
                this.lists = { ...this.lists, [kind]: [...list, created] };
        });
        void this.loadProject();
        return created;
    }

    async update(kind: TEntityKind, id: string, body: TUpdateEntityBody): Promise<TEntityDto> {
        const saved = await this.api.updateEntity(kind, id, body);
        runInAction(() => this.replaceInList(saved));
        return saved;
    }

    async remove(kind: TEntityKind, id: string, version: TVersion): Promise<TClearedReferencesDto> {
        const removed = await this.api.deleteEntity(kind, id, { version });
        runInAction(() => {
            const list = this.lists[kind];
            if (list) this.lists = { ...this.lists, [kind]: list.filter((e) => e.id !== id) };
        });
        void this.loadProject();
        return removed;
    }

    deleteReferences(kind: TEntityKind, id: string): Promise<TDeleteReferencesDto> {
        return this.api.getEntityReferences(kind, id);
    }

    catalogOf(name: string): TCatalogEntryDto[] {
        return this.catalogs[name] ?? [];
    }

    fetchCatalogEntry(name: string, id: string): Promise<TCatalogEntryDto> {
        return this.api.getCatalogEntry(name, id);
    }

    async createCatalogEntry(name: string, body: TCreateCatalogEntryBody): Promise<TCatalogEntryDto> {
        const created = await this.api.createCatalogEntry(name, body);
        runInAction(() => this.putCatalogEntry(created));
        return created;
    }

    async updateCatalogEntry(name: string, id: string, body: TUpdateCatalogEntryBody): Promise<TCatalogEntryDto> {
        const saved = await this.api.updateCatalogEntry(name, id, body);
        runInAction(() => this.putCatalogEntry(saved));
        return saved;
    }

    async removeCatalogEntry(name: string, id: string, version: TVersion): Promise<TClearedReferencesDto> {
        const removed = await this.api.deleteCatalogEntry(name, id, { version });
        runInAction(() => {
            this.catalogs = { ...this.catalogs, [name]: this.catalogOf(name).filter((e) => e.id !== id) };
        });
        return removed;
    }

    catalogDeleteReferences(name: string, id: string): Promise<TDeleteReferencesDto> {
        return this.api.getCatalogEntryReferences(name, id);
    }

    async passageIdsOf(characterId: string): Promise<string[]> {
        const chapters = (this.project?.chapters ?? []).filter((c) => c.characterIds.includes(characterId));
        const results = await Promise.all(chapters.map((c) => this.api.getChapter(c.id).catch(() => null)));
        return results.flatMap((ch) => ch?.characters.find((c) => c.characterId === characterId)?.passageIds ?? []);
    }

    private subscribe() {
        if (!this.events) return [];
        return [
            this.events.subscribe('entity', this.onEntityEvent),
            this.events.subscribe('project', this.onProjectEvent),
            this.events.subscribe('catalog', this.onCatalogEvent),
            this.events.onResync(this.refreshAll),
        ];
    }

    private onEntityEvent(event: TChangeEvent) {
        const kind = kindOfEventId(event.id);
        if (kind && this.lists[kind]) void this.loadList(kind);
        if (event.op === 'created' || event.op === 'deleted') void this.loadProject();
    }

    private onCatalogEvent(event: TChangeEvent) {
        const name = event.id.split('/')[0];
        if (name in this.catalogs) void this.loadCatalog(name);
    }

    private onProjectEvent() {
        void this.refreshAll();
    }

    private putCatalogEntry(entry: TCatalogEntryDto) {
        const list = this.catalogOf(entry.catalog);
        const next = list.some((e) => e.id === entry.id)
            ? list.map((e) => (e.id === entry.id ? entry : e))
            : [...list, entry];
        this.catalogs = { ...this.catalogs, [entry.catalog]: next };
    }

    private replaceInList(entity: TEntityDto) {
        const list = this.lists[entity.kind];
        if (list) this.lists = { ...this.lists, [entity.kind]: list.map((e) => (e.id === entity.id ? entity : e)) };
    }
}
