import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TChapterDto, TDiagnosticDto, TUpdateChapterBody } from '@story/visualizer-protocol';
import { ApiError, type TVisualizerApi } from '../../../api';
import { getUiState, removeUiState, setUiState } from '../../../ui-state';
import { mapDiagnostics } from '../editor/diagnostics';
import { CHAPTER_INFO_FIELDS, chapterFieldPaths, chapterInfoOf, type TChapterInfoValue } from './chapterInfo';

const draftKey = (chapterId: string) => `chapter-info-draft:${chapterId}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export class ChapterInfoEditorStore {
    chapter: TChapterDto | null = null;
    draft: TChapterInfoValue | null = null;
    saving = false;
    error: string | null = null;
    diagnostics: TDiagnosticDto[] = [];
    // current: null when the chapter was deleted
    conflict: { current: TChapterDto | null } | null = null;

    constructor(
        readonly chapterId: string,
        private readonly api: TVisualizerApi
    ) {
        makeObservable(this, {
            chapter: observable.ref,
            draft: observable.ref,
            saving: observable,
            error: observable,
            diagnostics: observable.ref,
            conflict: observable.ref,
            patch: computed,
            dirty: computed,
            setDraft: action,
            reloadFromDisk: action,
            onExternal: action,
        });
    }

    get patch(): Partial<TChapterInfoValue> {
        if (!this.chapter || !this.draft) return {};
        const base = chapterInfoOf(this.chapter);
        const patch: Partial<TChapterInfoValue> = {};
        for (const f of CHAPTER_INFO_FIELDS) {
            if (!same(this.draft[f], base[f])) Object.assign(patch, { [f]: this.draft[f] });
        }
        return patch;
    }

    get dirty() {
        return Object.keys(this.patch).length > 0;
    }

    private get diagnosticIndex() {
        return mapDiagnostics(this.diagnostics, chapterFieldPaths(this.draft));
    }

    diagnosticsFor = (path: string) => this.diagnosticIndex.byField.get(path) ?? [];

    get unmappedDiagnostics() {
        return this.diagnosticIndex.unmapped;
    }

    async load() {
        try {
            const chapter = await this.api.getChapter(this.chapterId);
            runInAction(() => {
                this.chapter = chapter;
                const saved = getUiState<{ version: string; draft: TChapterInfoValue } | null>(
                    draftKey(this.chapterId),
                    null
                );
                // a draft saved before a field was editable lacks it
                this.draft = { ...chapterInfoOf(chapter), ...saved?.draft };
                if (saved && saved.version !== chapter.version && this.dirty) this.conflict = { current: chapter };
            });
        } catch (e) {
            runInAction(() => (this.error = e instanceof Error ? e.message : String(e)));
        }
    }

    setDraft(draft: TChapterInfoValue) {
        this.draft = draft;
        if (this.chapter && this.dirty) setUiState(draftKey(this.chapterId), { version: this.chapter.version, draft });
        else removeUiState(draftKey(this.chapterId));
    }

    async save(): Promise<boolean> {
        if (!this.chapter || !this.dirty) return true;
        runInAction(() => {
            this.saving = true;
            this.error = null;
        });
        try {
            const body: TUpdateChapterBody = { version: this.chapter.version, ...this.patch };
            const saved = await this.api.updateChapter(this.chapterId, body);
            runInAction(() => {
                this.chapter = saved;
                this.draft = chapterInfoOf(saved);
                this.diagnostics = [];
                this.conflict = null;
                this.saving = false;
            });
            removeUiState(draftKey(this.chapterId));
            return true;
        } catch (e) {
            runInAction(() => {
                this.saving = false;
                if (e instanceof ApiError && e.isStale) this.conflict = { current: (e.current as TChapterDto) ?? null };
                else if (e instanceof ApiError && e.isInvalid) this.diagnostics = e.diagnostics;
                else this.error = e instanceof Error ? e.message : String(e);
            });
            return false;
        }
    }

    reloadFromDisk() {
        const current = this.conflict?.current;
        if (current) this.chapter = current;
        if (this.chapter) this.draft = chapterInfoOf(this.chapter);
        this.conflict = null;
        this.diagnostics = [];
        removeUiState(draftKey(this.chapterId));
    }

    // untouched fields take the disk's value, so only the author's edits overwrite
    keepMine(): Promise<boolean> {
        const current = this.conflict?.current;
        if (!current || !this.chapter || !this.draft) return Promise.resolve(false);
        const base = chapterInfoOf(this.chapter);
        const disk = chapterInfoOf(current);
        const draft = { ...this.draft };
        for (const f of CHAPTER_INFO_FIELDS) {
            if (same(draft[f], base[f])) Object.assign(draft, { [f]: disk[f] });
        }
        runInAction(() => {
            this.chapter = current;
            this.draft = draft;
            this.conflict = null;
        });
        return this.save();
    }

    async onExternal() {
        const current = await this.api.getChapter(this.chapterId).catch(() => null);
        runInAction(() => {
            if (!current) {
                this.conflict = { current: null };
            } else if (current.version !== this.chapter?.version) {
                if (this.dirty) this.conflict = { current };
                else {
                    this.chapter = current;
                    this.draft = chapterInfoOf(current);
                }
            }
        });
    }

    discard() {
        removeUiState(draftKey(this.chapterId));
    }
}
