import { action, computed, makeObservable, observable, reaction, runInAction, toJS } from 'mobx';
import type { TDiagnosticDto, TPassageDto, TPassageType, TUpdatePassageBody } from '@story/visualizer-protocol';
import { ApiError, type TVisualizerApi } from '../../../api';
import { getUiState, removeUiState, setUiState } from '../../../ui-state';
import { mapDiagnostics, passageFieldPaths, type TDiagnosticIndex } from './diagnostics';

const EDITABLE_FIELDS: Record<TPassageType, readonly string[]> = {
    screen: ['execute', 'title', 'image', 'body'],
    linear: ['execute', 'description', 'nextPassageId'],
    transition: ['execute', 'nextPassageId'],
};

// current: null when the passage was deleted
type TPassageConflict = { current: TPassageDto | null };

type TSavedDraft = { version: string; draft: TPassageDto };

const draftKey = (passageId: string) => `passage-draft:${passageId}`;

const clone = <T>(value: T): T => structuredClone(toJS(value));
// sorted keys, so re-adding a removed optional field is not a change
const stableJson = (value: unknown): string =>
    JSON.stringify(value, (_key, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
            : v
    );
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

export class PassageEditorStore {
    base: TPassageDto;
    draft: TPassageDto;
    saving = false;
    diagnostics: TDiagnosticDto[] = [];
    conflict: TPassageConflict | null = null;
    error: string | null = null;

    private readonly disposeDraftMirror: () => void;

    constructor(
        passage: TPassageDto,
        private readonly api: TVisualizerApi,
        private readonly onSaved?: (passage: TPassageDto) => void
    ) {
        this.base = clone(passage);
        this.draft = clone(passage);

        const saved = getUiState<TSavedDraft | null>(draftKey(passage.passageId), null);
        if (saved && saved.draft?.type === passage.type && saved.draft.passageId === passage.passageId) {
            this.draft = { ...clone(saved.draft), version: passage.version } as TPassageDto;
            // draft typed against an older file
            if (saved.version !== passage.version && this.dirty) this.conflict = { current: this.base };
        }

        makeObservable(this, {
            base: observable.ref,
            draft: observable,
            saving: observable,
            diagnostics: observable.ref,
            conflict: observable.ref,
            error: observable,
            dirty: computed,
            patch: computed,
            diagnosticIndex: computed,
            edit: action,
            reset: action,
            save: action,
            reloadFromDisk: action,
            keepMine: action,
            onExternal: action,
        });

        this.disposeDraftMirror = reaction(
            () => (this.dirty ? JSON.stringify(this.draft) : null),
            (json) => {
                const key = draftKey(this.base.passageId);
                if (json === null) removeUiState(key);
                else setUiState<TSavedDraft>(key, { version: this.base.version, draft: JSON.parse(json) });
            }
        );
    }

    get passageId() {
        return this.base.passageId;
    }

    get patch(): Record<string, unknown> {
        const patch: Record<string, unknown> = {};
        const draft = this.draft as unknown as Record<string, unknown>;
        const base = this.base as unknown as Record<string, unknown>;
        for (const field of EDITABLE_FIELDS[this.base.type]) {
            // a removed optional field (`execute`, `nextPassageId`) is sent as `null`
            if (!same(draft[field], base[field])) patch[field] = draft[field] === undefined ? null : toJS(draft[field]);
        }
        return patch;
    }

    get dirty(): boolean {
        return Object.keys(this.patch).length > 0;
    }

    get diagnosticIndex(): TDiagnosticIndex {
        return mapDiagnostics(this.diagnostics, passageFieldPaths(this.draft));
    }

    edit(mutate: (draft: TPassageDto) => void) {
        mutate(this.draft);
        this.error = null;
    }

    reset() {
        this.draft = clone(this.base);
        this.diagnostics = [];
        this.conflict = null;
        this.error = null;
    }

    async save(): Promise<boolean> {
        if (this.saving) return false;
        if (!this.dirty) {
            this.conflict = null;
            return true;
        }
        this.saving = true;
        this.error = null;
        const body = { version: this.base.version, ...this.patch } as TUpdatePassageBody;
        try {
            const saved = await this.api.updatePassage(this.passageId, body);
            runInAction(() => {
                this.base = clone(saved);
                this.draft = clone(saved);
                this.diagnostics = [];
                this.conflict = null;
                this.saving = false;
            });
            removeUiState(draftKey(this.passageId));
            this.onSaved?.(saved);
            return true;
        } catch (e) {
            runInAction(() => {
                this.saving = false;
                if (e instanceof ApiError && e.isStale) {
                    this.conflict = { current: (e.current as TPassageDto | null) ?? null };
                } else if (e instanceof ApiError && e.isInvalid) {
                    this.diagnostics = e.diagnostics;
                } else {
                    this.error = e instanceof Error ? e.message : String(e);
                }
            });
            return false;
        }
    }

    reloadFromDisk() {
        const current = this.conflict?.current;
        if (current) this.base = clone(current);
        this.reset();
    }

    // untouched fields take the disk's value, so only the author's edits overwrite
    keepMine(): Promise<boolean> {
        const current = this.conflict?.current;
        if (!current) return Promise.resolve(false);
        const draft = this.draft as unknown as Record<string, unknown>;
        const base = this.base as unknown as Record<string, unknown>;
        const disk = current as unknown as Record<string, unknown>;
        if (current.type === this.base.type) {
            for (const field of EDITABLE_FIELDS[current.type]) {
                if (same(draft[field], base[field])) draft[field] = clone(disk[field]);
            }
        }
        this.base = clone(current);
        this.conflict = null;
        return this.save();
    }

    onExternal(passage: TPassageDto | null) {
        if (passage === null) {
            this.conflict = { current: null };
            return;
        }
        if (passage.version === this.base.version) return;
        if (!this.dirty) {
            this.base = clone(passage);
            this.draft = clone(passage);
            this.diagnostics = [];
            this.conflict = null;
        } else {
            this.conflict = { current: clone(passage) };
        }
    }

    discard() {
        removeUiState(draftKey(this.passageId));
    }

    destroy() {
        this.disposeDraftMirror();
    }
}
