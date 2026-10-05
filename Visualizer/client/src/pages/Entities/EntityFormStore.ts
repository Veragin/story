import { makeAutoObservable, observable, runInAction } from 'mobx';
import {
    isEntityKind,
    type TChangeEvent,
    type TEntityDto,
    type TEntityKind,
    type TVersion,
} from '@story/visualizer-protocol';
import { ApiError, errorMessage, type ApiEvents } from '../../api';
import type { TDiagnosticsOf } from '../../components/inputs/inputTypes';
import { DraftResource } from '../../stores/DraftResource';
import type { EntityStore } from '../../stores/EntityStore';
import { writeResult } from '../../stores/writeResult';
import { getUiState, setUiState } from '../../ui-state';
import { deepEqual } from '../../deepEqual';
import { diffEditable, editableOf, withFields } from './entityFields';

type TSavedDraft = { baseVersion: TVersion; draft: TEntityDto };

type TEntityFormStoreOptions = {
    entities: EntityStore;
    events?: ApiEvents;
    persist?: boolean;
};

const SELECTION_KEY = 'entities.selection';
const DRAFTS_KEY = 'entities.drafts';

type TEntitiesSelection = {
    kind: TEntityKind;
    ids: Partial<Record<TEntityKind, string>>;
};

const entityKey = (kind: TEntityKind, id: string) => `${kind}/${id}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isEntityDto = (value: unknown): value is TEntityDto =>
    isRecord(value) && typeof value.kind === 'string' && isEntityKind(value.kind) && typeof value.id === 'string';

const sameEditable = (a: TEntityDto, b: TEntityDto) => deepEqual(editableOf(a), editableOf(b));

export class EntityFormStore {
    kind: TEntityKind = 'characters';
    selectedId: string | null = null;
    loading = false;
    notFound = false;

    drafts: Record<string, TSavedDraft> = {};
    lastIds: Partial<Record<TEntityKind, string>> = {};

    readonly entities: EntityStore;
    readonly resource: DraftResource<TEntityDto, TEntityDto>;
    private readonly events?: ApiEvents;
    private readonly persist: boolean;
    private offs: (() => void)[] = [];
    private loadToken = 0;

    constructor({ entities, events, persist = true }: TEntityFormStoreOptions) {
        this.entities = entities;
        this.events = events;
        this.persist = persist;
        if (persist) {
            const selection = getUiState<TEntitiesSelection | null>(SELECTION_KEY, null);
            if (isRecord(selection)) {
                this.kind = selection.kind ?? this.kind;
                this.lastIds = selection.ids ?? {};
            }
            const drafts = getUiState<Record<string, TSavedDraft>>(DRAFTS_KEY, {});
            this.drafts = isRecord(drafts) ? drafts : {};
        }
        this.resource = new DraftResource<TEntityDto, TEntityDto>({
            toDraft: (base) => base,
            sameDraft: sameEditable,
            parseCurrent: (current) => (isEntityDto(current) ? current : null),
            write: (base, draft, version) =>
                writeResult(() => this.entities.update(base.kind, base.id, { version, ...diffEditable(base, draft) })),
            recreate: (draft) =>
                writeResult(() => this.entities.create(draft.kind, { id: draft.id, ...editableOf(draft) })),
            onChange: () => this.afterEdit(),
            onGone: () => this.onGone(),
        });
        makeAutoObservable<EntityFormStore, 'events' | 'offs' | 'loadToken'>(
            this,
            {
                entities: false,
                resource: false,
                events: false,
                offs: false,
                loadToken: false,
                drafts: observable.ref,
            },
            { autoBind: true }
        );
    }

    get base() {
        return this.resource.base;
    }

    get draft() {
        return this.resource.draft;
    }

    get stale() {
        return this.resource.stale;
    }

    get saving() {
        return this.resource.saving;
    }

    get diagnostics() {
        return this.resource.diagnostics;
    }

    get references() {
        return this.resource.references;
    }

    get cleared() {
        return this.resource.cleared;
    }

    get error() {
        return this.resource.error;
    }

    get list(): TEntityDto[] {
        return this.entities.listOf(this.kind);
    }

    get changes(): Record<string, unknown> {
        if (!this.base || !this.draft) return {};
        return diffEditable(this.base, this.draft);
    }

    get dirty(): boolean {
        return this.resource.dirty;
    }

    hasDraft(kind: TEntityKind, id: string) {
        return entityKey(kind, id) in this.drafts;
    }

    fieldDiagnostics(field: string) {
        return this.diagnostics.filter((d) => d.field === field || d.field?.startsWith(`${field}.`));
    }

    exactDiagnostics(field: string) {
        return this.diagnostics.filter((d) => d.field === field);
    }

    diagnosticsUnder(prefix: string): TDiagnosticsOf {
        return (path) => this.exactDiagnostics(`${prefix}.${path}`);
    }

    lastIdOf(kind: TEntityKind): string | undefined {
        return this.lastIds[kind];
    }

    start() {
        const releaseEntities = this.entities.start();
        if (this.offs.length > 0) return this.dispose;
        this.offs.push(releaseEntities);
        if (this.events) {
            this.offs.push(
                this.events.subscribe('entity', this.onEntityEvent),
                this.events.onResync(() => void this.refreshSelected())
            );
        }
        return this.dispose;
    }

    dispose() {
        this.offs.splice(0).forEach((off) => off());
    }

    async show(kind: TEntityKind, id?: string | null) {
        const nextId = id ?? null;
        const idChanged = nextId !== this.selectedId || kind !== this.kind;
        this.kind = kind;
        if (nextId) this.lastIds[kind] = nextId;
        this.saveSelection();

        const tasks: Promise<void>[] = [];
        if (!this.entities.lists[kind]) tasks.push(this.entities.loadList(kind));
        if (idChanged) {
            this.selectedId = nextId;
            this.clearForm();
            if (nextId) tasks.push(this.loadEntity(kind, nextId));
        }
        await Promise.all(tasks);
    }

    forget(kind: TEntityKind, id: string) {
        if (this.lastIds[kind] === id) delete this.lastIds[kind];
        this.dropDraft(kind, id);
        this.saveSelection();
    }

    setField(key: string, value: unknown) {
        this.setFields({ [key]: value });
    }

    setFields(patch: Record<string, unknown>) {
        if (this.draft) this.resource.edit(withFields(this.draft, patch));
    }

    discard() {
        this.resource.discard();
    }

    save(): Promise<boolean> {
        return this.resource.save();
    }

    reload() {
        if (this.resource.stale) this.resource.reload();
        else void this.refreshSelected(true);
    }

    keepMine(): Promise<boolean> {
        return this.resource.keepMine();
    }

    async remove(): Promise<boolean> {
        const base = this.base;
        if (!base) return false;
        const removed = await this.resource.remove(() =>
            writeResult(() => this.entities.remove(base.kind, base.id, base.version))
        );
        if (!removed) return false;
        runInAction(() => {
            this.forget(base.kind, base.id);
            if (this.kind === base.kind && this.selectedId === base.id) this.selectedId = null;
        });
        return true;
    }

    dismissReferences() {
        this.resource.dismissReferences();
    }

    dismissCleared() {
        this.resource.dismissCleared();
    }

    dismissError() {
        this.resource.dismissError();
    }

    async refreshSelected(force = false) {
        const kind = this.kind;
        const id = this.selectedId;
        if (!id) return;
        const token = ++this.loadToken;
        let current: TEntityDto | null;
        try {
            current = await this.entities.fetch(kind, id);
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) {
                runInAction(() => {
                    if (token === this.loadToken) this.resource.showError(errorMessage(e));
                });
                return;
            }
            current = null;
        }
        runInAction(() => {
            if (token !== this.loadToken || this.kind !== kind || this.selectedId !== id) return;
            this.resource.external(current, force);
            if (current) this.notFound = false;
        });
    }

    private async loadEntity(kind: TEntityKind, id: string) {
        const token = ++this.loadToken;
        this.loading = true;
        try {
            const dto = await this.entities.fetch(kind, id);
            runInAction(() => {
                if (token === this.loadToken) this.adopt(dto);
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

    private adopt(dto: TEntityDto) {
        const saved = this.drafts[entityKey(dto.kind, dto.id)];
        this.notFound = false;
        if (!saved || sameEditable(saved.draft, dto)) {
            this.resource.load(dto);
            this.dropDraft(dto.kind, dto.id);
            return;
        }
        // a draft based on an older version keeps its input, with the stale notice
        const stale = saved.baseVersion !== dto.version ? { current: dto } : null;
        this.resource.load(dto, { ...saved.draft, version: dto.version }, stale);
    }

    private onGone() {
        this.notFound = true;
        if (this.selectedId) this.dropDraft(this.kind, this.selectedId);
    }

    private onEntityEvent(event: TChangeEvent) {
        const [kind, id = '*'] = event.id.split('/');
        if (kind === this.kind && this.selectedId && (id === '*' || id === this.selectedId)) {
            void this.refreshSelected();
        }
    }

    private clearForm() {
        this.notFound = false;
        this.resource.reset();
    }

    private afterEdit() {
        const base = this.resource.base;
        const draft = this.resource.draft;
        if (!base || !draft) return;
        const key = entityKey(base.kind, base.id);
        if (this.resource.dirty) {
            this.drafts = { ...this.drafts, [key]: { baseVersion: base.version, draft } };
            this.saveDrafts();
        } else if (key in this.drafts) {
            this.dropDraft(base.kind, base.id);
        }
    }

    private dropDraft(kind: TEntityKind, id: string) {
        const key = entityKey(kind, id);
        if (!(key in this.drafts)) return;
        const next = { ...this.drafts };
        delete next[key];
        this.drafts = next;
        this.saveDrafts();
    }

    private saveDrafts() {
        if (this.persist) setUiState(DRAFTS_KEY, this.drafts);
    }

    private saveSelection() {
        if (this.persist) setUiState<TEntitiesSelection>(SELECTION_KEY, { kind: this.kind, ids: this.lastIds });
    }
}
