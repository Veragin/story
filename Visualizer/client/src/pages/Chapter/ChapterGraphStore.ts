import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import type { TPoint } from '@story/shared';
import {
    EMPTY_VERSION,
    type TChapterDto,
    type TChapterLayoutDto,
    type TCreatePassageBody,
    type TPassageDto,
    type TPassageEdgeDto,
    type TProjectDto,
    type TReferenceDto,
    type TSourceOwner,
} from '@story/visualizer-protocol';
import { ApiError, displayText, type ApiEvents, type TVisualizerApi } from '../../api';
import { getUiState, setUiState } from '../../ui-state';
import { BOX, GAP, placeMissing } from './graph/autoLayout';
import { buildGraph, type TGraph } from './graph/buildGraph';
import { PassageEditorStore } from './editor/PassageEditorStore';

export type TSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type TChapterGraphOptions = {
    chapterId: string;
    api: TVisualizerApi;
    events: ApiEvents;
    /** Delay between the last box move and the layout PUT. */
    saveDelayMs?: number;
};

/** What the remove-character confirmation shows. */
export type TRemoveCharacterSummary = {
    characterId: string;
    name: string;
    chapterTitle: string;
    passageCount: number;
    passageIds: string[];
    message: string;
};

/** The remove / delete was refused with `409 referenced`. */
export class ReferencedError extends Error {
    constructor(readonly references: TReferenceDto[]) {
        super('referenced');
        this.name = 'ReferencedError';
    }
}

export const uiKeys = {
    camera: (chapterId: string) => `chapter:${chapterId}:camera`,
    selected: (chapterId: string) => `chapter:${chapterId}:selected`,
    editor: (chapterId: string) => `chapter:${chapterId}:editor`,
};

/** Re-running an async loader while it is in flight queues exactly one more run. */
const coalesce = (fn: () => Promise<void>) => {
    let running: Promise<void> | null = null;
    let again = false;
    return (): Promise<void> => {
        if (running) {
            again = true;
            return running;
        }
        running = (async () => {
            try {
                do {
                    again = false;
                    await fn();
                } while (again);
            } finally {
                running = null;
            }
        })();
        return running;
    };
};

/**
 * Everything the chapter view (plan WP6) shows and does, without the canvas: the chapter, its
 * passages and static edges, the saved box positions (`<ch>.layout.json`) plus automatic ones
 * for boxes that have none, the selection, the open passage editor, the debounced layout save
 * and live refresh through `apiEvents`.
 */
export class ChapterGraphStore {
    readonly chapterId: string;
    readonly api: TVisualizerApi;
    private readonly events: ApiEvents;
    private readonly saveDelayMs: number;

    status: 'loading' | 'ready' | 'error' = 'loading';
    loadError: string | null = null;

    chapter: TChapterDto | null = null;
    passages: TPassageDto[] = [];
    rawEdges: TPassageEdgeDto[] = [];
    layout: TChapterLayoutDto | null = null;
    project: TProjectDto | null = null;

    /** In-memory positions of boxes without a saved one; stable until the page closes. */
    autoPositions: Record<string, TPoint> = {};

    selectedId: string | null;
    editor: PassageEditorStore | null = null;
    saveStatus: TSaveStatus = 'idle';
    saveError: string | null = null;

    private pendingMoves = new Map<string, TPoint>();
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private saving: Promise<void> | null = null;
    private disposers: (() => void)[] = [];
    private pendingEditorId: string | null;

    constructor({ chapterId, api, events, saveDelayMs = 500 }: TChapterGraphOptions) {
        this.chapterId = chapterId;
        this.api = api;
        this.events = events;
        this.saveDelayMs = saveDelayMs;
        this.selectedId = getUiState<string | null>(uiKeys.selected(chapterId), null);
        this.pendingEditorId = getUiState<string | null>(uiKeys.editor(chapterId), null);

        makeObservable<this, 'applyPassages' | 'applyLayout'>(this, {
            status: observable,
            loadError: observable,
            chapter: observable.ref,
            passages: observable.ref,
            rawEdges: observable.ref,
            layout: observable.ref,
            project: observable.ref,
            autoPositions: observable.ref,
            selectedId: observable,
            editor: observable.ref,
            saveStatus: observable,
            saveError: observable,
            graph: computed,
            positions: computed,
            chapterTitle: computed,
            chapterCharacters: computed,
            availableCharacters: computed,
            selectedPassage: computed,
            select: action,
            setPosition: action,
            openEditor: action,
            closeEditor: action,
            applyPassages: action,
            applyLayout: action,
        });
    }

    // ---- derived -----------------------------------------------------------------------------

    get graph(): TGraph {
        return buildGraph(this.passages, this.rawEdges);
    }

    /** Top-left corner of every box (saved, else automatic) and of every ghost box. */
    get positions(): Record<string, TPoint> {
        const result: Record<string, TPoint> = {};
        const saved = this.layout?.passages ?? {};
        for (const n of this.graph.nodes) {
            const p = saved[n.id] ?? this.autoPositions[n.id];
            if (p) result[n.id] = p;
        }
        // Ghosts sit to the right of the first passage that links to them, stacked.
        const perSource = new Map<string, number>();
        for (const e of this.graph.edges) {
            if (result[e.to] || !this.graph.ghosts.some((g) => g.id === e.to)) continue;
            const src = result[e.from];
            if (!src) continue;
            const i = perSource.get(e.from) ?? 0;
            perSource.set(e.from, i + 1);
            result[e.to] = { x: src.x + BOX.width + GAP.x, y: src.y + i * (BOX.height / 2 + GAP.y / 2) };
        }
        return result;
    }

    get chapterTitle(): string {
        return this.chapter ? displayText(this.chapter.title, this.chapterId) : this.chapterId;
    }

    get chapterCharacters(): { id: string; name: string; passageCount: number; passageIds: string[] }[] {
        return (this.chapter?.characters ?? []).map((c) => ({
            id: c.characterId,
            name: this.characterName(c.characterId),
            passageCount: c.passageCount,
            passageIds: c.passageIds,
        }));
    }

    /** Characters of the project that are not in this chapter yet (for "Add character"). */
    get availableCharacters(): { id: string; name: string }[] {
        const inChapter = new Set(this.chapter?.characters.map((c) => c.characterId));
        return (this.project?.characters ?? []).filter((c) => !inChapter.has(c.id));
    }

    get selectedPassage(): TPassageDto | null {
        return this.passages.find((p) => p.passageId === this.selectedId) ?? null;
    }

    characterName(characterId: string): string {
        return this.project?.characters.find((c) => c.id === characterId)?.name ?? characterId;
    }

    // ---- loading and live refresh --------------------------------------------------------------

    async load(): Promise<void> {
        try {
            const [chapter, list, layout, project] = await Promise.all([
                this.api.getChapter(this.chapterId),
                this.api.listChapterPassages(this.chapterId),
                this.api.getChapterLayout(this.chapterId),
                this.api.getProject().catch(() => null),
            ]);
            runInAction(() => {
                this.chapter = chapter;
                this.project = project;
                this.applyLayout(layout);
                this.applyPassages(list.passages, list.edges);
                this.status = 'ready';
                this.loadError = null;
            });
            if (this.pendingEditorId) {
                const id = this.pendingEditorId;
                this.pendingEditorId = null;
                if (this.passages.some((p) => p.passageId === id)) this.openEditor(id);
            }
        } catch (e) {
            runInAction(() => {
                this.status = 'error';
                this.loadError = e instanceof Error ? e.message : String(e);
            });
        }
    }

    /** Subscribe to change events. Returns the store (`await store.start().load()` style is not needed). */
    start(): this {
        const ch = this.chapterId;
        this.disposers.push(
            this.events.subscribe({ kind: 'chapter', id: ch }, (e) => {
                if (e.op === 'deleted') {
                    runInAction(() => {
                        this.status = 'error';
                        this.loadError = _('Chapter %s was deleted', ch);
                    });
                    return;
                }
                // Adding / removing a character is a chapter event that also adds / removes passages.
                void this.refetchChapter();
                void this.refetchPassages();
            }),
            this.events.subscribe({ kind: 'passage', chapterId: ch }, () => void this.refetchPassages()),
            this.events.subscribe({ kind: 'layout', id: `chapters/${ch}` }, () => void this.refetchLayout()),
            this.events.subscribe('project', () => void this.refetchProject()),
            this.events.subscribe('entity', (e) => {
                if (e.id.startsWith('characters/') || e.id === '*') void this.refetchProject();
            }),
            this.events.onResync(() => void this.refetchAll())
        );
        return this;
    }

    refetchChapter = coalesce(async () => {
        const chapter = await this.api.getChapter(this.chapterId).catch(() => null);
        if (chapter) runInAction(() => (this.chapter = chapter));
    });

    refetchPassages = coalesce(async () => {
        const list = await this.api.listChapterPassages(this.chapterId).catch(() => null);
        if (list) this.applyPassages(list.passages, list.edges);
    });

    refetchLayout = coalesce(async () => {
        const layout = await this.api.getChapterLayout(this.chapterId).catch(() => null);
        if (layout) this.applyLayout(layout);
    });

    refetchProject = coalesce(async () => {
        const project = await this.api.getProject().catch(() => null);
        if (project) runInAction(() => (this.project = project));
    });

    refetchAll = async () => {
        await Promise.all([this.refetchChapter(), this.refetchPassages(), this.refetchLayout(), this.refetchProject()]);
    };

    private applyPassages(passages: TPassageDto[], edges: TPassageEdgeDto[]) {
        this.passages = passages;
        this.rawEdges = edges;
        this.fillAutoPositions();
        if (this.selectedId && !passages.some((p) => p.passageId === this.selectedId)) this.select(null);
        if (this.editor) this.editor.onExternal(passages.find((p) => p.passageId === this.editor?.passageId) ?? null);
    }

    /** A fetched layout, with the moves that are not saved yet laid over it. */
    private applyLayout(layout: TChapterLayoutDto) {
        this.layout = {
            ...layout,
            passages: { ...layout.passages, ...Object.fromEntries(this.pendingMoves) },
        };
        this.fillAutoPositions();
    }

    /** Give every box without a saved or automatic position an automatic one. */
    private fillAutoPositions() {
        const { nodes, edges } = this.graph;
        const fixed: Record<string, TPoint> = { ...this.autoPositions, ...(this.layout?.passages ?? {}) };
        const layoutNodes = nodes.map((n) => ({ id: n.id, group: n.characterId }));
        const added = placeMissing(layoutNodes, edges, fixed);
        if (Object.keys(added).length > 0) this.autoPositions = { ...this.autoPositions, ...added };
    }

    // ---- selection, editor ------------------------------------------------------------------------

    select(passageId: string | null) {
        this.selectedId = passageId;
        setUiState(uiKeys.selected(this.chapterId), passageId ?? undefined);
    }

    openEditor(passageId: string) {
        const passage = this.passages.find((p) => p.passageId === passageId);
        if (!passage) return;
        if (this.editor?.passageId === passageId) return;
        this.editor?.destroy();
        this.editor = new PassageEditorStore(passage, this.api, (saved) => this.onPassageSaved(saved));
        setUiState(uiKeys.editor(this.chapterId), passageId);
    }

    closeEditor() {
        this.editor?.destroy();
        this.editor = null;
        setUiState(uiKeys.editor(this.chapterId), undefined);
    }

    private onPassageSaved(saved: TPassageDto) {
        runInAction(() => {
            this.passages = this.passages.map((p) => (p.passageId === saved.passageId ? saved : p));
        });
        // Links may have changed: the edges come from the server's static extraction.
        void this.refetchPassages();
    }

    // ---- positions ----------------------------------------------------------------------------------

    /** A box was dragged: keep it there and save the layout after `saveDelayMs` of quiet. */
    setPosition(passageId: string, p: TPoint) {
        const point = { x: Math.round(p.x), y: Math.round(p.y) };
        this.pendingMoves.set(passageId, point);
        this.layout = {
            chapterId: this.chapterId,
            version: this.layout?.version ?? EMPTY_VERSION,
            passages: { ...(this.layout?.passages ?? {}), [passageId]: point },
        };
        this.saveStatus = 'pending';
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.flushLayout();
        }, this.saveDelayMs);
    }

    get hasUnsavedLayout() {
        return this.pendingMoves.size > 0 || this.saving !== null;
    }

    /** Save the pending moves now (also called on unmount). */
    async flushLayout(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        if (this.saving) {
            await this.saving;
            if (this.pendingMoves.size > 0) return this.flushLayout();
            return;
        }
        if (this.pendingMoves.size === 0) return;
        this.saving = this.saveLayout().finally(() => (this.saving = null));
        await this.saving;
    }

    private async saveLayout(attempt = 0): Promise<void> {
        const moves = new Map(this.pendingMoves);
        this.pendingMoves.clear();
        runInAction(() => (this.saveStatus = 'saving'));
        const known = new Set(this.passages.map((p) => p.passageId));
        const base = this.layout?.passages ?? {};
        // Positions of passages that no longer exist are dropped (unless nothing is loaded yet).
        const passages = Object.fromEntries(
            Object.entries({ ...base, ...Object.fromEntries(moves) }).filter(
                ([id]) => known.size === 0 || known.has(id)
            )
        );
        try {
            const saved = await this.api.updateChapterLayout(this.chapterId, {
                version: this.layout?.version ?? EMPTY_VERSION,
                passages,
            });
            runInAction(() => {
                this.applyLayout(saved);
                this.saveStatus = this.pendingMoves.size > 0 ? 'pending' : 'saved';
                this.saveError = null;
            });
        } catch (e) {
            // Put the moves back (newer ones win) so nothing is lost.
            for (const [id, p] of moves) if (!this.pendingMoves.has(id)) this.pendingMoves.set(id, p);
            if (e instanceof ApiError && e.isStale && attempt === 0) {
                // Someone else wrote the layout: take theirs, lay our moves over it, try once more.
                const current = e.current as TChapterLayoutDto | null;
                runInAction(() =>
                    this.applyLayout(current ?? { chapterId: this.chapterId, version: EMPTY_VERSION, passages: {} })
                );
                return this.saveLayout(1);
            }
            runInAction(() => {
                this.saveStatus = 'error';
                this.saveError = e instanceof Error ? e.message : String(e);
            });
        }
    }

    // ---- actions ------------------------------------------------------------------------------------

    async addCharacter(characterId: string, startPassageLocalId?: string): Promise<TChapterDto> {
        const chapter = await this.api.addChapterCharacter(this.chapterId, {
            characterId,
            ...(startPassageLocalId ? { startPassageLocalId } : {}),
        });
        runInAction(() => (this.chapter = chapter));
        await this.refetchPassages();
        const start = `${this.chapterId}-${characterId}-${startPassageLocalId || 'intro'}`;
        if (this.passages.some((p) => p.passageId === start)) this.select(start);
        return chapter;
    }

    /** Text and numbers for the "Remove Thomas from Village? This deletes 3 passages." confirmation. */
    removeCharacterSummary(characterId: string): TRemoveCharacterSummary {
        const entry = this.chapter?.characters.find((c) => c.characterId === characterId);
        const passageCount = entry?.passageCount ?? 0;
        const name = this.characterName(characterId);
        const chapterTitle = this.chapterTitle;
        const message =
            passageCount === 1
                ? _('Remove %s from %s? This deletes 1 passage.', name, chapterTitle)
                : _('Remove %s from %s? This deletes %d passages.', name, chapterTitle, passageCount);
        return { characterId, name, chapterTitle, passageCount, passageIds: entry?.passageIds ?? [], message };
    }

    /** Throws `ReferencedError` on `409 referenced` (nothing was deleted). */
    async removeCharacter(characterId: string): Promise<void> {
        const version = this.chapter?.version ?? EMPTY_VERSION;
        try {
            const chapter = await this.api.removeChapterCharacter(this.chapterId, characterId, { version });
            runInAction(() => (this.chapter = chapter));
        } catch (e) {
            if (e instanceof ApiError && e.isReferenced) throw new ReferencedError(e.references);
            if (e instanceof ApiError && e.isStale) {
                // The chapter changed under us; refresh so the next try uses the new version.
                await this.refetchChapter();
            }
            throw e;
        }
        if (this.editor && this.editor.base.characterId === characterId) this.closeEditor();
        await this.refetchPassages();
    }

    async createPassage(body: TCreatePassageBody): Promise<TPassageDto> {
        const passage = await this.api.createPassage(this.chapterId, body);
        await Promise.all([this.refetchPassages(), this.refetchChapter()]);
        this.select(passage.passageId);
        return passage;
    }

    /** Throws `ReferencedError` on `409 referenced`. */
    async deletePassage(passageId: string): Promise<void> {
        const passage = this.passages.find((p) => p.passageId === passageId);
        if (!passage) return;
        try {
            await this.api.deletePassage(passageId, { version: passage.version });
        } catch (e) {
            if (e instanceof ApiError && e.isReferenced) throw new ReferencedError(e.references);
            if (e instanceof ApiError && e.isStale) await this.refetchPassages();
            throw e;
        }
        if (this.editor?.passageId === passageId) {
            this.editor.discard();
            this.closeEditor();
        }
        if (this.selectedId === passageId) this.select(null);
        await Promise.all([this.refetchPassages(), this.refetchChapter()]);
    }

    /** What the source editor opens: the selected passage's file, else the chapter file. */
    sourceTarget(passageId = this.selectedId): { owner: TSourceOwner; id: string } {
        return passageId ? { owner: 'passage', id: passageId } : { owner: 'chapter', id: this.chapterId };
    }

    async destroy(): Promise<void> {
        for (const d of this.disposers.splice(0)) d();
        this.editor?.destroy();
        await this.flushLayout().catch(() => undefined);
    }
}
