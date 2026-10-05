import { makeAutoObservable, runInAction } from 'mobx';
import type { TCatalogEntryDto, TChangeEvent, TValueRecord } from '@story/visualizer-protocol';
import { ApiError, errorMessage, type ApiEvents } from '../../api';
import { DraftResource } from '../../stores/DraftResource';
import type { EntityStore } from '../../stores/EntityStore';
import { writeResult } from '../../stores/writeResult';
import { deepEqual } from '../../deepEqual';

type TCatalogFormStoreOptions = {
    entities: EntityStore;
    events?: ApiEvents;
};

const isCatalogEntry = (value: unknown): value is TCatalogEntryDto =>
    typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'catalog';

export class CatalogFormStore {
    catalog: string | null = null;
    selectedId: string | null = null;
    loading = false;
    notFound = false;

    readonly entities: EntityStore;
    readonly resource: DraftResource<TCatalogEntryDto, TValueRecord>;
    private readonly events?: ApiEvents;
    private lastIds: Record<string, string> = {};
    private offs: (() => void)[] = [];
    private loadToken = 0;

    constructor({ entities, events }: TCatalogFormStoreOptions) {
        this.entities = entities;
        this.events = events;
        this.resource = new DraftResource<TCatalogEntryDto, TValueRecord>({
            toDraft: (base) => base.values,
            sameDraft: deepEqual,
            parseCurrent: (current) => (isCatalogEntry(current) ? current : null),
            write: (base, values, version) =>
                writeResult(() => this.entities.updateCatalogEntry(base.catalog, base.id, { version, values })),
            recreate: (values) => this.recreate(values),
            onGone: () => {
                this.notFound = true;
            },
        });
        makeAutoObservable<CatalogFormStore, 'events' | 'offs' | 'loadToken'>(
            this,
            { entities: false, resource: false, events: false, offs: false, loadToken: false },
            { autoBind: true }
        );
    }

    get list(): TCatalogEntryDto[] {
        return this.catalog ? this.entities.catalogOf(this.catalog) : [];
    }

    lastIdOf(catalog: string): string | undefined {
        return this.lastIds[catalog];
    }

    start() {
        const releaseEntities = this.entities.start();
        if (this.offs.length > 0) return this.dispose;
        this.offs.push(releaseEntities);
        if (this.events) {
            this.offs.push(
                this.events.subscribe('catalog', this.onCatalogEvent),
                this.events.onResync(() => void this.refreshSelected())
            );
        }
        return this.dispose;
    }

    dispose() {
        this.offs.splice(0).forEach((off) => off());
    }

    async show(catalog: string, id?: string) {
        const nextId = id ?? null;
        const changed = catalog !== this.catalog || nextId !== this.selectedId;
        this.catalog = catalog;
        if (nextId) this.lastIds[catalog] = nextId;
        if (!(catalog in this.entities.catalogs)) void this.entities.loadCatalog(catalog);
        if (!changed) return;
        this.selectedId = nextId;
        this.notFound = false;
        this.resource.reset();
        if (nextId) await this.load(catalog, nextId);
    }

    setValues(values: TValueRecord) {
        this.resource.edit(values);
    }

    async remove(): Promise<boolean> {
        const base = this.resource.base;
        if (!base) return false;
        const removed = await this.resource.remove(() =>
            writeResult(() => this.entities.removeCatalogEntry(base.catalog, base.id, base.version))
        );
        if (removed) {
            runInAction(() => {
                if (this.lastIds[base.catalog] === base.id) delete this.lastIds[base.catalog];
                if (this.catalog === base.catalog && this.selectedId === base.id) this.selectedId = null;
            });
        }
        return removed;
    }

    async refreshSelected(force = false) {
        const catalog = this.catalog;
        const id = this.selectedId;
        if (!catalog || !id) return;
        const token = ++this.loadToken;
        let current: TCatalogEntryDto | null;
        try {
            current = await this.entities.fetchCatalogEntry(catalog, id);
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) {
                runInAction(() => this.resource.showError(errorMessage(e)));
                return;
            }
            current = null;
        }
        runInAction(() => {
            if (token !== this.loadToken || this.catalog !== catalog || this.selectedId !== id) return;
            this.resource.external(current, force);
            if (current) this.notFound = false;
        });
    }

    private async load(catalog: string, id: string) {
        const token = ++this.loadToken;
        this.loading = true;
        try {
            const entry = await this.entities.fetchCatalogEntry(catalog, id);
            runInAction(() => {
                if (token === this.loadToken) this.resource.load(entry);
            });
        } catch (e) {
            runInAction(() => {
                if (token !== this.loadToken) return;
                if (e instanceof ApiError && e.isNotFound) this.notFound = true;
                else this.resource.showError(errorMessage(e));
            });
        } finally {
            runInAction(() => {
                if (token === this.loadToken) this.loading = false;
            });
        }
    }

    private recreate(values: TValueRecord) {
        const { catalog, selectedId } = this;
        if (!catalog || !selectedId) return Promise.resolve({ status: 'error' as const, message: 'Nothing selected' });
        return writeResult(() => this.entities.createCatalogEntry(catalog, { id: selectedId, values }));
    }

    private onCatalogEvent(event: TChangeEvent) {
        const [catalog, id = '*'] = event.id.split('/');
        if (catalog === this.catalog && this.selectedId && (id === '*' || id === this.selectedId)) {
            void this.refreshSelected();
        }
    }
}
