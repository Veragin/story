import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TChapterDto, TDiagnosticDto, TProjectDto, TUpdateChapterBody } from '@story/visualizer-protocol';
import { ApiError, type TVisualizerApi } from '../../../api';
import { getUiState, removeUiState, setUiState } from '../../../ui-state';
import { mapDiagnostics } from '../editor/diagnostics';
import { CHAPTER_INFO_FIELDS, chapterInfoOf, type TChapterInfoValue } from './chapterInfo';

const draftKey = (chapterId: string) => `chapter-info-draft:${chapterId}`;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const FIELD_PATHS = (v: TChapterInfoValue) => {
    const fields = new Set<string>(CHAPTER_INFO_FIELDS);
    fields.add('timeRange.start').add('timeRange.end');
    if (Array.isArray(v.children)) {
        v.children.forEach((_c, i) => fields.add(`children.${i}.chapterId`).add(`children.${i}.condition`));
    }
    return fields;
};

/** Load / edit / save of one chapter's info, with versions, 409 stale and 422 diagnostics. */
export class ChapterInfoEditorStore {
    chapter: TChapterDto | null = null;
    project: TProjectDto | null = null;
    draft: TChapterInfoValue | null = null;
    saving = false;
    error: string | null = null;
    diagnostics: TDiagnosticDto[] = [];
    /** On disk now, when it changed under the draft (`null`: deleted). */
    conflict: { current: TChapterDto | null } | null = null;

    constructor(
        readonly chapterId: string,
        private readonly api: TVisualizerApi
    ) {
        makeObservable(this, {
            chapter: observable.ref,
            project: observable.ref,
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

    diagnosticsFor = (path: string) =>
        mapDiagnostics(this.diagnostics, FIELD_PATHS(this.draft ?? ({} as TChapterInfoValue))).byField.get(path) ?? [];

    get unmappedDiagnostics() {
        return mapDiagnostics(this.diagnostics, FIELD_PATHS(this.draft ?? ({} as TChapterInfoValue))).unmapped;
    }

    async load() {
        try {
            const [chapter, project] = await Promise.all([
                this.api.getChapter(this.chapterId),
                this.api.getProject().catch(() => null),
            ]);
            runInAction(() => {
                this.chapter = chapter;
                this.project = project;
                const saved = getUiState<{ version: string; draft: TChapterInfoValue } | null>(
                    draftKey(this.chapterId),
                    null
                );
                this.draft = saved?.draft ?? chapterInfoOf(chapter);
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
            const body = { version: this.chapter.version, ...this.patch } as TUpdateChapterBody;
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

    /**
     * "Keep mine": rebase the draft on the version on disk and save it over. Fields the author
     * did not touch take the disk's value, so only their own edits overwrite the other change.
     */
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

    /** A chapter change event arrived. */
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
