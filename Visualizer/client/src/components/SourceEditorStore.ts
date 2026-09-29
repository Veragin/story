import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TDiagnosticDto, TSourceDto, TSourceOwner } from '@story/visualizer-protocol';
import { ApiError, type ApiEvents, type TVisualizerApi } from '../api';

/**
 * The state of `SourceEditorDialog`: the whole `.ts` file of a chapter or passage
 * (`GET/PUT /source/:owner/:id`), the author's unsaved text, the 422 diagnostics of the last
 * save, and the "changed on disk" conflict.
 *
 *  - `save()` sends the whole text with the version it is based on. `422` keeps the text and
 *    shows the diagnostics; `409 stale` opens the conflict ("Reload" / "Keep mine").
 *  - A change event for the owner (a hand edit, a form save, another tab) refetches the file:
 *    it replaces a clean text, and opens the conflict over unsaved input.
 */
export class SourceEditorStore {
    base: TSourceDto | null = null;
    text = '';
    loadError: string | null = null;
    error: string | null = null;
    saving = false;
    diagnostics: TDiagnosticDto[] = [];
    /** Set on `409 stale`, or when the file changed on disk under unsaved input. `null` current = deleted. */
    conflict: { current: TSourceDto | null } | null = null;
    private disposers: (() => void)[] = [];

    constructor(
        readonly owner: TSourceOwner,
        readonly id: string,
        private readonly api: TVisualizerApi,
        private readonly events?: ApiEvents
    ) {
        makeObservable<SourceEditorStore, 'take'>(this, {
            base: observable.ref,
            text: observable,
            loadError: observable,
            error: observable,
            saving: observable,
            diagnostics: observable.ref,
            conflict: observable.ref,
            dirty: computed,
            fileDiagnostics: computed,
            otherDiagnostics: computed,
            setText: action,
            reloadFromDisk: action,
            take: action,
        });
    }

    get dirty() {
        return this.base !== null && this.text !== this.base.text;
    }

    /** Diagnostics in this file (shown beside their lines). */
    get fileDiagnostics() {
        return this.diagnostics.filter((d) => d.file === this.base?.file);
    }

    /** Diagnostics the edit causes in other files (listed above the editor). */
    get otherDiagnostics() {
        return this.diagnostics.filter((d) => d.file !== this.base?.file);
    }

    start() {
        if (this.events) {
            this.disposers.push(
                this.events.subscribe({ kind: this.owner, id: this.id }, () => void this.onExternal()),
                this.events.onResync(() => void this.onExternal())
            );
        }
        return this.load();
    }

    destroy() {
        for (const d of this.disposers.splice(0)) d();
    }

    async load() {
        try {
            const source = await this.api.getSource(this.owner, this.id);
            this.take(source);
        } catch (e) {
            runInAction(() => (this.loadError = (e as Error).message));
        }
    }

    setText(text: string) {
        this.text = text;
    }

    /** Resolves `true` when everything is on disk. */
    async save(): Promise<boolean> {
        if (!this.base || this.saving || this.conflict) return false;
        if (!this.dirty) return true;
        runInAction(() => {
            this.saving = true;
            this.error = null;
        });
        try {
            const saved = await this.api.updateSource(this.owner, this.id, {
                version: this.base.version,
                text: this.text,
            });
            this.take(saved);
            return true;
        } catch (e) {
            runInAction(() => {
                if (e instanceof ApiError && e.isInvalid) {
                    this.diagnostics = e.diagnostics;
                    this.error = e.diagnostics.length === 0 ? e.message : null;
                } else if (e instanceof ApiError && e.isStale) {
                    this.conflict = { current: (e.current as TSourceDto | null) ?? null };
                } else {
                    this.error = (e as Error).message;
                }
            });
            return false;
        } finally {
            runInAction(() => (this.saving = false));
        }
    }

    /** "Reload": take the file on disk, drop my text. */
    reloadFromDisk() {
        const current = this.conflict?.current;
        if (!current) return;
        this.take(current);
    }

    /** "Keep mine": save my text over the file on disk. */
    async keepMine() {
        const current = this.conflict?.current;
        if (!current) return;
        runInAction(() => {
            this.base = current;
            this.conflict = null;
        });
        await this.save();
    }

    /** The file may have changed on disk: refetch, and replace or conflict. */
    async onExternal() {
        // a save in flight knows better (and this may be its own echo)
        if (this.saving || !this.base) return;
        let current: TSourceDto | null;
        try {
            current = await this.api.getSource(this.owner, this.id);
        } catch (e) {
            if (!(e instanceof ApiError && e.isNotFound)) return;
            current = null;
        }
        if (this.saving || current?.version === this.base.version) return;
        if (current && !this.dirty) this.take(current);
        else runInAction(() => (this.conflict = { current }));
    }

    private take(source: TSourceDto) {
        this.base = source;
        this.text = source.text;
        this.conflict = null;
        this.diagnostics = [];
        this.error = null;
        this.loadError = null;
    }
}
