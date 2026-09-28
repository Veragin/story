import { action, computed, makeObservable, observable, reaction, runInAction, toJS } from 'mobx';
import type { TDiagnosticDto, TPassageDto, TPassageType, TUpdatePassageBody } from '@story/visualizer-protocol';
import { ApiError, type TVisualizerApi } from '../../../api';
import { getUiState, removeUiState, setUiState } from '../../../ui-state';
import { mapDiagnostics, passageFieldPaths, type TDiagnosticIndex } from './diagnostics';

/** The fields a PUT may carry per passage type (ids, type and the source ref are read-only). */
export const EDITABLE_FIELDS: Record<TPassageType, readonly string[]> = {
    screen: ['title', 'image', 'body'],
    linear: ['description', 'nextPassageId'],
    transition: ['nextPassageId'],
};

/**
 * `current` is what is on disk now (`null`: the passage was deleted). Shown as "changed on disk
 * — reload / keep mine".
 */
export type TPassageConflict = { current: TPassageDto | null };

type TSavedDraft = { version: string; draft: TPassageDto };

export const draftKey = (passageId: string) => `passage-draft:${passageId}`;

const clone = <T>(value: T): T => structuredClone(toJS(value));
/** JSON with sorted keys, so re-adding a removed optional field does not count as a change. */
const stableJson = (value: unknown): string =>
    JSON.stringify(value, (_key, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
            : v
    );
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

/**
 * State of the passage editor for one passage: the DTO it is based on (`base`, with its
 * version), the author's working copy (`draft`), save status, 422 diagnostics and the 409 /
 * live-refresh conflict. Unsaved input is mirrored into `ui-state` so it survives a reload.
 */
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
            // The draft was typed against an older file: let the author choose.
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

    /** The editable fields that differ from `base` — exactly what `save` sends. */
    get patch(): Record<string, unknown> {
        const patch: Record<string, unknown> = {};
        const draft = this.draft as unknown as Record<string, unknown>;
        const base = this.base as unknown as Record<string, unknown>;
        for (const field of EDITABLE_FIELDS[this.base.type]) {
            if (!same(draft[field], base[field])) patch[field] = toJS(draft[field]);
        }
        return patch;
    }

    get dirty(): boolean {
        return Object.keys(this.patch).length > 0;
    }

    get diagnosticIndex(): TDiagnosticIndex {
        return mapDiagnostics(this.diagnostics, passageFieldPaths(this.draft));
    }

    /** Mutate the draft: `store.edit((d) => { if (d.type === 'screen') d.title = 'x'; })`. */
    edit(mutate: (draft: TPassageDto) => void) {
        mutate(this.draft);
        this.error = null;
    }

    /** Throw the draft away. */
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

    /** "Reload": take what is on disk and drop the draft. */
    reloadFromDisk() {
        const current = this.conflict?.current;
        if (current) this.base = clone(current);
        this.reset();
    }

    /**
     * "Keep mine": rebase the draft on the version on disk and save it over. Fields the author
     * did not touch take the disk's value, so only their own edits overwrite the other change.
     */
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

    /**
     * The passage changed outside this editor (live refresh, or the graph refetched). A clean
     * editor follows silently; a dirty one gets the conflict banner. `null`: deleted.
     */
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

    /** Forget the persisted draft too (the author closed the editor and discarded it). */
    discard() {
        removeUiState(draftKey(this.passageId));
    }

    destroy() {
        this.disposeDraftMirror();
    }
}
