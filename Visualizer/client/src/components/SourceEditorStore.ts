import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TDiagnosticDto, TSourceDto, TSourceOwner } from '@story/visualizer-protocol';
import { ApiError, type ApiEvents, type TVisualizerApi } from '../api';

export class SourceEditorStore {
    base: TSourceDto | null = null;
    text = '';
    loadError: string | null = null;
    error: string | null = null;
    saving = false;
    diagnostics: TDiagnosticDto[] = [];
    // `current: null` means deleted on disk
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

    get fileDiagnostics() {
        return this.diagnostics.filter((d) => d.file === this.base?.file);
    }

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
            runInAction(() => (this.loadError = e instanceof Error ? e.message : String(e)));
        }
    }

    setText(text: string) {
        this.text = text;
    }

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
                    this.error = e instanceof Error ? e.message : String(e);
                }
            });
            return false;
        } finally {
            runInAction(() => (this.saving = false));
        }
    }

    reloadFromDisk() {
        const current = this.conflict?.current;
        if (!current) return;
        this.take(current);
    }

    async keepMine() {
        const current = this.conflict?.current;
        if (!current) return;
        runInAction(() => {
            this.base = current;
            this.conflict = null;
        });
        await this.save();
    }

    async onExternal() {
        // a save in flight wins; this may be its own echo
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
