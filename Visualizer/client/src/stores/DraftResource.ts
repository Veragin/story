import { makeAutoObservable, observable, runInAction } from 'mobx';
import type { TClearedReferenceDto, TDiagnosticDto, TOkDto, TReferenceDto, TVersion } from '@story/visualizer-protocol';
import type { TWriteFailure, TWriteResult } from './writeResult';

export type TStale<T> = { current: T | null };

type TVersionedBase = { version: TVersion };

export type TDraftResourceOptions<T extends TVersionedBase, D> = {
    toDraft: (base: T) => D;
    sameDraft: (a: D, b: D) => boolean;
    parseCurrent: (current: unknown) => T | null;
    write: (base: T, draft: D, version: TVersion) => Promise<TWriteResult<T>>;
    recreate?: (draft: D) => Promise<TWriteResult<T>>;
    onChange?: () => void;
    onGone?: () => void;
};

type TRemoved = TOkDto & { cleared?: TClearedReferenceDto[] };

export class DraftResource<T extends TVersionedBase, D> {
    base: T | null = null;
    draft: D | null = null;
    stale: TStale<T> | null = null;
    saving = false;
    diagnostics: TDiagnosticDto[] = [];
    references: TReferenceDto[] | null = null;
    cleared: TClearedReferenceDto[] | null = null;
    info: string | null = null;
    error: string | null = null;

    private readonly options: TDraftResourceOptions<T, D>;
    // a write answered after the selection changed must not land in the new one
    private epoch = 0;

    constructor(options: TDraftResourceOptions<T, D>) {
        this.options = options;
        makeAutoObservable<DraftResource<T, D>, 'options' | 'epoch'>(
            this,
            {
                options: false,
                epoch: false,
                base: observable.ref,
                draft: observable.ref,
                stale: observable.ref,
                diagnostics: observable.ref,
                references: observable.ref,
                cleared: observable.ref,
            },
            { autoBind: true }
        );
    }

    get dirty(): boolean {
        if (this.draft === null) return false;
        if (this.stale?.current === null) return true;
        return this.base !== null && !this.options.sameDraft(this.draft, this.options.toDraft(this.base));
    }

    reset() {
        this.epoch++;
        this.base = null;
        this.draft = null;
        this.stale = null;
        this.diagnostics = [];
        this.references = null;
        this.cleared = null;
        this.info = null;
        this.error = null;
    }

    load(base: T, draft?: D, stale: TStale<T> | null = null) {
        this.base = base;
        this.draft = draft ?? this.options.toDraft(base);
        this.stale = stale;
        this.diagnostics = [];
        this.changed();
    }

    clear() {
        this.epoch++;
        this.base = null;
        this.draft = null;
        this.stale = null;
        this.diagnostics = [];
    }

    edit(draft: D) {
        if (this.draft === null) return;
        this.draft = draft;
        this.changed();
    }

    discard() {
        if (!this.base) return;
        this.draft = this.options.toDraft(this.base);
        this.stale = this.stale?.current === null ? this.stale : null;
        this.diagnostics = [];
        this.changed();
    }

    external(current: T | null, force = false) {
        const base = this.base;
        if (current && base && current.version === base.version && !force) return;
        if (current && base && this.dirty && !force && this.sameContent(current, base)) {
            this.rebase(current);
            return;
        }
        if (this.dirty && !force) {
            this.stale = { current };
            return;
        }
        this.stale = null;
        if (current === null) {
            this.gone();
            return;
        }
        this.load(current);
    }

    reload() {
        const stale = this.stale;
        if (!stale) return;
        this.stale = null;
        this.diagnostics = [];
        if (stale.current === null) this.gone();
        else this.load(stale.current);
    }

    save(): Promise<boolean> {
        if (!this.base || this.draft === null || this.saving) return Promise.resolve(false);
        return this.put(this.base.version);
    }

    keepMine(): Promise<boolean> {
        const stale = this.stale;
        if (!stale || this.draft === null || this.saving) return Promise.resolve(false);
        if (stale.current === null) return this.recreate();
        return this.put(stale.current.version);
    }

    async remove(call: (base: T) => Promise<TWriteResult<TRemoved>>): Promise<boolean> {
        const base = this.base;
        if (!base) return false;
        this.references = null;
        this.cleared = null;
        this.error = null;
        const result = await call(base);
        runInAction(() => {
            if (this.base !== base) return;
            if (result.status !== 'ok') {
                this.fail(result);
                return;
            }
            this.clear();
            this.cleared = result.value.cleared?.length ? result.value.cleared : null;
        });
        return result.status === 'ok';
    }

    showError(message: string) {
        this.error = message;
    }

    showInfo(message: string | null) {
        this.info = message;
    }

    dismissReferences() {
        this.references = null;
    }

    dismissCleared() {
        this.cleared = null;
    }

    dismissInfo() {
        this.info = null;
    }

    dismissError() {
        this.error = null;
    }

    private sameContent(a: T, b: T): boolean {
        return this.options.sameDraft(this.options.toDraft(a), this.options.toDraft(b));
    }

    private rebase(current: T) {
        this.base = current;
        this.changed();
    }

    private gone() {
        this.base = null;
        this.draft = null;
        this.options.onGone?.();
    }

    private async put(version: TVersion, retried = false): Promise<boolean> {
        const base = this.base;
        const draft = this.draft;
        if (!base || draft === null) return false;
        const epoch = this.epoch;
        this.saving = true;
        this.error = null;
        this.info = null;
        this.references = null;
        this.diagnostics = [];
        try {
            const result = await this.options.write(base, draft, version);
            if (result.status === 'ok') {
                runInAction(() => {
                    if (epoch !== this.epoch) return;
                    this.stale = null;
                    // input typed while the request was in flight stays in the draft
                    const typedMeanwhile = this.draft !== draft;
                    this.base = result.value;
                    if (!typedMeanwhile) this.draft = this.options.toDraft(result.value);
                    this.changed();
                });
                return true;
            }
            const current = result.status === 'stale' ? this.options.parseCurrent(result.current) : null;
            if (!retried && current && this.base === base && this.sameContent(current, base)) {
                // only the file around the resource changed (a sibling, our own literal write)
                runInAction(() => this.rebase(current));
                return await this.put(current.version, true);
            }
            runInAction(() => {
                if (epoch === this.epoch) this.fail(result);
            });
            return false;
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    }

    private async recreate(): Promise<boolean> {
        const draft = this.draft;
        const recreate = this.options.recreate;
        if (draft === null || !recreate) return false;
        this.saving = true;
        this.error = null;
        try {
            const result = await recreate(draft);
            runInAction(() => {
                if (result.status === 'ok') this.load(result.value);
                else this.fail(result);
            });
            return result.status === 'ok';
        } finally {
            runInAction(() => {
                this.saving = false;
            });
        }
    }

    private fail(failure: TWriteFailure) {
        switch (failure.status) {
            case 'stale':
                this.stale = { current: this.options.parseCurrent(failure.current) };
                return;
            case 'invalid':
                this.diagnostics = failure.diagnostics;
                return;
            case 'referenced':
                this.references = failure.references;
                return;
            case 'exists':
            case 'error':
                this.error = failure.message;
        }
    }

    private changed() {
        this.options.onChange?.();
    }
}
