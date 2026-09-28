import { makeAutoObservable, observable, runInAction } from 'mobx';
import type {
    TChangeEvent,
    TCreateEntityBody,
    TDiagnosticDto,
    TEntityDto,
    TEntityKind,
    TProjectDto,
    TReferenceDto,
    TVersion,
} from '@story/visualizer-protocol';
import { ApiError, type ApiEvents, type TVisualizerApi } from '../../api';
import { getUiState, setUiState } from '../../ui-state';
import { deepEqual, diffEditable, editableOf } from './entityFields';

/**
 * State of the Entities page (plan WP7): the list of each kind, the selected entity, its form
 * draft, and the save / stale / delete flow.
 *
 *  - `base` is the server copy the draft started from; `draft` is what the form shows. A save
 *    sends only the fields that differ (`diffEditable`) with `base.version`.
 *  - 409 `stale` (on save, or an external change while the form is dirty) sets `stale`: the UI
 *    offers `reload()` (take theirs) or `keepMine()` (re-send my changes on their version).
 *  - 422 fills `diagnostics`, 409 `referenced` on delete fills `references`.
 *  - Live refresh: `start()` subscribes to `entity` and `project` events. A clean form is
 *    refetched in place; a dirty one keeps its input and gets the stale notice instead.
 *  - The selection (kind, last id per kind) and unsaved drafts live in `ui-state`, so a reload
 *    of the page restores them.
 *
 * Router-free on purpose (the page syncs `#/entities/:kind/:id` with `show()`), so it can be
 * tested against `createMockApi`.
 */

export type TStale = {
    /** The version on disk now, or `null` when the entity was deleted there. */
    current: TEntityDto | null;
};

type TSavedDraft = { baseVersion: TVersion; draft: TEntityDto };

export type TEntitiesStoreOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
    /** Mirror the selection and unsaved drafts into `sessionStorage` (default true). */
    persist?: boolean;
};

const SELECTION_KEY = 'entities.selection';
const DRAFTS_KEY = 'entities.drafts';

export type TEntitiesSelection = {
    kind: TEntityKind;
    /** Last selected id per kind, so switching kinds comes back to it. */
    ids: Partial<Record<TEntityKind, string>>;
};

export const entityKey = (kind: TEntityKind, id: string) => `${kind}/${id}`;

const errorMessage = (e: unknown): string => {
    if (e instanceof ApiError) {
        if (e.isNotImplemented) return 'The server does not implement this route yet (501).';
        return e.body.message ? `${e.body.error}: ${e.body.message}` : `${e.body.error} (${e.status})`;
    }
    return e instanceof Error ? e.message : String(e);
};

export class EntitiesStore {
    kind: TEntityKind = 'characters';
    selectedId: string | null = null;

    lists: Partial<Record<TEntityKind, TEntityDto[]>> = {};
    listLoading = false;
    listError: string | null = null;
    project: TProjectDto | null = null;

    base: TEntityDto | null = null;
    draft: TEntityDto | null = null;
    loading = false;
    notFound = false;
    saving = false;

    stale: TStale | null = null;
    diagnostics: TDiagnosticDto[] = [];
    references: TReferenceDto[] | null = null;
    error: string | null = null;

    /** Unsaved input per `kind/id`, including entities that are not selected right now. */
    drafts: Record<string, TSavedDraft> = {};
    lastIds: Partial<Record<TEntityKind, string>> = {};

    readonly api: TVisualizerApi;
    private readonly events?: ApiEvents;
    private readonly persist: boolean;
    private offs: (() => void)[] = [];
    private loadToken = 0;
    private listTokens: Partial<Record<TEntityKind, number>> = {};

    constructor({ api, events, persist = true }: TEntitiesStoreOptions) {
        this.api = api;
        this.events = events;
        this.persist = persist;
        if (persist) {
            const selection = getUiState<TEntitiesSelection | null>(SELECTION_KEY, null);
            if (selection && typeof selection === 'object') {
                this.kind = selection.kind ?? this.kind;
                this.lastIds = selection.ids ?? {};
            }
            const drafts = getUiState<Record<string, TSavedDraft>>(DRAFTS_KEY, {});
            this.drafts = drafts && typeof drafts === 'object' ? drafts : {};
        }
        makeAutoObservable<EntitiesStore, 'api' | 'events' | 'offs' | 'loadToken' | 'listTokens'>(
            this,
            {
                api: false,
                events: false,
                offs: false,
                loadToken: false,
                listTokens: false,
                // Replaced, never mutated: plain objects stay plain (the api deep-clones bodies).
                lists: observable.ref,
                project: observable.ref,
                base: observable.ref,
                draft: observable.ref,
                stale: observable.ref,
                diagnostics: observable.ref,
                references: observable.ref,
                drafts: observable.ref,
            },
            { autoBind: true }
        );
    }

    /* ------------------------------------------------------------ derived */

    get list(): TEntityDto[] {
        return this.lists[this.kind] ?? [];
    }

    /** The editable fields the form changed, i.e. the next PUT body without `version`. */
    get changes(): Record<string, unknown> {
        if (!this.base || !this.draft) return {};
        return diffEditable(this.base, this.draft);
    }

    get dirty(): boolean {
        if (!this.draft) return false;
        if (this.stale?.current === null) return true;
        return Object.keys(this.changes).length > 0;
    }

    /** Whether `kind/id` has unsaved input (for the list's dot). */
    hasDraft = (kind: TEntityKind, id: string) => entityKey(kind, id) in this.drafts;

    /** Diagnostics of one top-level field (`init`, `name`, …); `field` may be a dotted path. */
    fieldDiagnostics = (field: string) =>
        this.diagnostics.filter((d) => d.field === field || d.field?.startsWith(`${field}.`));

    /** Ids of the entities of `kind` known so far (list, else the project summary). */
    idsOf = (kind: TEntityKind): string[] =>
        this.lists[kind]?.map((e) => e.id) ?? this.project?.[kind].map((e) => e.id) ?? [];

    /** The last selected id of `kind` (for switching kinds from the menu). */
    lastIdOf = (kind: TEntityKind): string | undefined => this.lastIds[kind];

    /* ------------------------------------------------------------ lifecycle */

    /** Subscribe to live refresh. Returns `dispose`. Idempotent. */
    start() {
        if (this.offs.length > 0 || !this.events) return this.dispose;
        this.offs.push(
            this.events.subscribe('entity', this.onEntityEvent),
            this.events.subscribe('project', this.onProjectEvent),
            this.events.onResync(this.refreshAll)
        );
        void this.loadProject();
        return this.dispose;
    }

    dispose() {
        this.offs.splice(0).forEach((off) => off());
    }

    /* ------------------------------------------------------------ navigation */

    /**
     * Show `kind` and (optionally) the entity `id`. Loads the list the first time a kind is
     * shown and the entity whenever the selection changes. Unsaved input of the previous entity
     * stays in `drafts`.
     */
    async show(kind: TEntityKind, id?: string | null) {
        const nextId = id ?? null;
        const kindChanged = kind !== this.kind || !this.lists[kind];
        const idChanged = nextId !== this.selectedId || kind !== this.kind;
        this.kind = kind;
        if (nextId) this.lastIds[kind] = nextId;
        this.saveSelection();

        const tasks: Promise<void>[] = [];
        if (kindChanged && !this.lists[kind]) tasks.push(this.loadList(kind));
        if (idChanged) {
            this.selectedId = nextId;
            this.clearForm();
            if (nextId) tasks.push(this.loadEntity(kind, nextId));
        }
        await Promise.all(tasks);
    }

    /** Forget the selection of `kind` (after a delete). */
    forget(kind: TEntityKind, id: string) {
        if (this.lastIds[kind] === id) delete this.lastIds[kind];
        this.dropDraft(kind, id);
        this.saveSelection();
    }

    /* ------------------------------------------------------------ editing */

    /** Replace one top-level field of the draft. */
    setField(key: string, value: unknown) {
        if (!this.draft) return;
        this.draft = { ...this.draft, [key]: value } as TEntityDto;
        this.afterEdit();
    }

    /** Drop the unsaved input (back to `base`). */
    discard() {
        if (!this.base) return;
        this.draft = this.base;
        this.stale = this.stale?.current === null ? this.stale : null;
        this.diagnostics = [];
        this.afterEdit();
    }

    save(): Promise<boolean> {
        if (!this.base || !this.draft || this.saving) return Promise.resolve(false);
        return this.put(this.base.version);
    }

    /** "Changed on disk → reload": take the version on disk, drop my input. */
    reload() {
        const stale = this.stale;
        if (!stale) {
            void this.refreshSelected(true);
            return;
        }
        this.stale = null;
        this.diagnostics = [];
        if (stale.current === null) {
            const id = this.selectedId;
            if (id) this.dropDraft(this.kind, id);
            this.base = null;
            this.draft = null;
            this.notFound = true;
            return;
        }
        this.base = stale.current;
        this.draft = stale.current;
        this.afterEdit();
    }

    /** "Changed on disk → keep mine": re-send my changes on top of the version on disk. */
    keepMine(): Promise<boolean> {
        const stale = this.stale;
        if (!stale || !this.draft || this.saving) return Promise.resolve(false);
        if (stale.current === null) return this.recreate();
        return this.put(stale.current.version);
    }

    /** Create an entity of `kind`. Throws `ApiError` (409 exists, 422, …) for the dialog. */
    async create(kind: TEntityKind, body: TCreateEntityBody): Promise<TEntityDto> {
        const created = (await this.api.createEntity(kind, body as never)) as TEntityDto;
        runInAction(() => {
            const list = this.lists[kind];
            if (list && !list.some((e) => e.id === created.id))
                this.lists = { ...this.lists, [kind]: [...list, created] };
        });
        void this.loadProject();
        return created;
    }

    /**
     * Delete the selected entity. Resolves `true` when it is gone. A 409 `referenced` fills
     * `references` (nothing is deleted), a 409 `stale` sets `stale`.
     */
    async remove(): Promise<boolean> {
        const base = this.base;
        if (!base) return false;
        this.references = null;
        this.error = null;
        try {
            await this.api.deleteEntity(base.kind, base.id, { version: base.version });
        } catch (e) {
            runInAction(() => {
                if (e instanceof ApiError && e.isReferenced) this.references = e.references;
                else if (e instanceof ApiError && e.isStale) this.stale = { current: e.current as TEntityDto | null };
                else this.error = errorMessage(e);
            });
            return false;
        }
        runInAction(() => {
            const list = this.lists[base.kind];
            if (list) this.lists = { ...this.lists, [base.kind]: list.filter((e) => e.id !== base.id) };
            this.forget(base.kind, base.id);
            if (this.kind === base.kind && this.selectedId === base.id) {
                this.selectedId = null;
                this.clearForm();
            }
        });
        void this.loadProject();
        return true;
    }

    dismissReferences() {
        this.references = null;
    }

    dismissError() {
        this.error = null;
    }

    /* ------------------------------------------------------------ loading */

    async loadList(kind: TEntityKind) {
        const token = (this.listTokens[kind] ?? 0) + 1;
        this.listTokens[kind] = token;
        this.listLoading = true;
        this.listError = null;
        try {
            const { entities } = await this.api.listEntities(kind);
            runInAction(() => {
                if (this.listTokens[kind] !== token) return;
                this.lists = { ...this.lists, [kind]: entities as TEntityDto[] };
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

    /** Full passage ids of `characterId` in every chapter (options of `startPassageId`). */
    async passageIdsOf(characterId: string): Promise<string[]> {
        const chapters = (this.project?.chapters ?? []).filter((c) => c.characterIds.includes(characterId));
        const results = await Promise.all(chapters.map((c) => this.api.getChapter(c.id).catch(() => null)));
        return results.flatMap((ch) => ch?.characters.find((c) => c.characterId === characterId)?.passageIds ?? []);
    }

    /** Refetch everything on screen (after a reconnect: events may have been missed). */
    async refreshAll() {
        const kinds = Object.keys(this.lists) as TEntityKind[];
        await Promise.all([...kinds.map((k) => this.loadList(k)), this.refreshSelected(), this.loadProject()]);
    }

    /**
     * Refetch the selected entity in place. A clean form takes the new version; a dirty one
     * keeps the input and gets the stale notice (unless the version did not change).
     */
    async refreshSelected(force = false) {
        const kind = this.kind;
        const id = this.selectedId;
        if (!id) return;
        const token = ++this.loadToken;
        let current: TEntityDto | null;
        try {
            current = (await this.api.getEntity(kind, id)) as TEntityDto;
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) {
                runInAction(() => {
                    if (token === this.loadToken) this.error = errorMessage(e);
                });
                return;
            }
            current = null;
        }
        runInAction(() => {
            if (token !== this.loadToken || this.kind !== kind || this.selectedId !== id) return;
            if (current && this.base && current.version === this.base.version && !force) return;
            if (this.dirty && !force) {
                this.stale = { current };
                return;
            }
            this.stale = null;
            if (current === null) {
                this.base = null;
                this.draft = null;
                this.notFound = true;
                this.dropDraft(kind, id);
                return;
            }
            this.base = current;
            this.draft = current;
            this.notFound = false;
            this.afterEdit();
        });
    }

    private async loadEntity(kind: TEntityKind, id: string) {
        const token = ++this.loadToken;
        this.loading = true;
        try {
            const dto = (await this.api.getEntity(kind, id)) as TEntityDto;
            runInAction(() => {
                if (token !== this.loadToken) return;
                this.adopt(dto);
            });
        } catch (e) {
            runInAction(() => {
                if (token !== this.loadToken) return;
                if (e instanceof ApiError && e.isNotFound) this.notFound = true;
                else this.error = errorMessage(e);
            });
        } finally {
            runInAction(() => {
                if (token === this.loadToken) this.loading = false;
            });
        }
    }

    /** Take a freshly loaded entity, restoring the unsaved draft kept for it (if any). */
    private adopt(dto: TEntityDto) {
        const saved = this.drafts[entityKey(dto.kind, dto.id)];
        this.base = dto;
        this.notFound = false;
        if (!saved || deepEqual(editableOf(saved.draft), editableOf(dto))) {
            this.draft = dto;
            this.dropDraft(dto.kind, dto.id);
            return;
        }
        this.draft = { ...saved.draft, version: dto.version } as TEntityDto;
        // The draft was based on an older version: its input survives, but say so.
        if (saved.baseVersion !== dto.version) this.stale = { current: dto };
    }

    /* ------------------------------------------------------------ writes */

    private async put(version: TVersion): Promise<boolean> {
        const base = this.base;
        const draft = this.draft;
        if (!base || !draft) return false;
        const body = { version, ...diffEditable(base, draft) };
        this.saving = true;
        this.error = null;
        this.diagnostics = [];
        try {
            const saved = (await this.api.updateEntity(base.kind, base.id, body as never)) as TEntityDto;
            runInAction(() => {
                this.replaceInList(saved);
                if (this.base?.kind !== saved.kind || this.base.id !== saved.id) return;
                this.stale = null;
                // Input typed while the request was in flight stays in the draft.
                const typedMeanwhile = this.draft !== draft;
                this.base = saved;
                this.draft =
                    typedMeanwhile && this.draft ? ({ ...this.draft, version: saved.version } as TEntityDto) : saved;
                this.afterEdit();
            });
            return true;
        } catch (e) {
            runInAction(() => {
                // The author moved on to another entity while the request was in flight.
                if (this.base?.kind !== base.kind || this.base.id !== base.id) return;
                if (e instanceof ApiError && e.isStale) this.stale = { current: e.current as TEntityDto | null };
                else if (e instanceof ApiError && e.isInvalid) this.diagnostics = e.diagnostics;
                else this.error = errorMessage(e);
            });
            return false;
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    }

    /** "Keep mine" after the entity was deleted on disk: create it again from the draft. */
    private async recreate(): Promise<boolean> {
        const draft = this.draft;
        if (!draft) return false;
        this.saving = true;
        this.error = null;
        try {
            const created = await this.create(draft.kind, {
                id: draft.id,
                ...editableOf(draft),
            } as TCreateEntityBody);
            runInAction(() => {
                this.stale = null;
                this.base = created;
                this.draft = created;
                this.afterEdit();
            });
            return true;
        } catch (e) {
            runInAction(() => {
                if (e instanceof ApiError && e.isInvalid) this.diagnostics = e.diagnostics;
                else this.error = errorMessage(e);
            });
            return false;
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    }

    /* ------------------------------------------------------------ events */

    private onEntityEvent(event: TChangeEvent) {
        const slash = event.id.indexOf('/');
        const kind = (slash === -1 ? event.id : event.id.slice(0, slash)) as TEntityKind;
        const id = slash === -1 ? '*' : event.id.slice(slash + 1);
        if (this.lists[kind]) void this.loadList(kind);
        if (event.op === 'created' || event.op === 'deleted') void this.loadProject();
        if (kind === this.kind && this.selectedId && (id === '*' || id === this.selectedId)) {
            void this.refreshSelected();
        }
    }

    private onProjectEvent() {
        void this.loadProject();
        if (this.lists[this.kind]) void this.loadList(this.kind);
    }

    /* ------------------------------------------------------------ internals */

    private clearForm() {
        this.base = null;
        this.draft = null;
        this.notFound = false;
        this.stale = null;
        this.diagnostics = [];
        this.references = null;
        this.error = null;
    }

    private replaceInList(entity: TEntityDto) {
        const list = this.lists[entity.kind];
        if (list) this.lists = { ...this.lists, [entity.kind]: list.map((e) => (e.id === entity.id ? entity : e)) };
    }

    /** Keep `drafts` in step with the form after any change of `base` / `draft`. */
    private afterEdit() {
        if (!this.base || !this.draft) return;
        const key = entityKey(this.base.kind, this.base.id);
        if (this.dirty) {
            this.drafts = { ...this.drafts, [key]: { baseVersion: this.base.version, draft: this.draft } };
            this.saveDrafts();
        } else if (key in this.drafts) {
            this.dropDraft(this.base.kind, this.base.id);
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
