import { action, makeAutoObservable, observable, runInAction } from 'mobx';
import { showToast, type TToastVariant } from '@story/shared';
import type {
    TChapterDto,
    TChangeEvent,
    TProjectDto,
    TReferenceDto,
    TTimelineLayoutDto,
    TTriggerDto,
    TUpdateTriggerBody,
} from '@story/visualizer-protocol';
import { ApiError, displayText, type ApiEvents, type TVisualizerApi } from '../../../api';
import { getUiState, setUiState } from '../../../ui-state';
import {
    clampPxPerSecond,
    DEFAULT_PX_PER_SECOND,
    formatTime,
    parseRange,
    parseTime,
    timeToX,
    xToTime,
} from './timeScale';

export type TTimelineSelection = { kind: 'chapter' | 'trigger'; id: string } | null;

export type TTimelineCamera = { x: number; y: number };

export type TTimelineDeps = {
    confirm: (options: { title: string; message?: string; danger?: boolean }) => Promise<boolean>;
    showReferences: (title: string, references: TReferenceDto[]) => void;
    notify: (message: string, variant?: TToastVariant) => void;
    openChapter: (chapterId: string) => void;
};

export const CHAPTER_HEIGHT = 50;
const DEFAULT_ROW_HEIGHT = 70;

const UI_KEYS = {
    camera: 'timeline:camera',
    toggles: 'timeline:toggles',
    selected: 'timeline:selected',
} as const;

type TToggles = { showConnections: boolean; showTriggers: boolean; characterId: string | null; pps: number };

const DEFAULT_TOGGLES: TToggles = {
    showConnections: true,
    showTriggers: true,
    characterId: null,
    pps: DEFAULT_PX_PER_SECOND,
};

export const errorMessage = (e: unknown) => {
    if (e instanceof ApiError) {
        if (e.isNotImplemented) return _('The server does not implement this yet (501).');
        if (e.isInvalid) return e.diagnostics.map((d) => `${d.file}:${d.line} ${d.message}`).join('\n') || e.message;
        return e.body.message ?? e.message;
    }
    return e instanceof Error ? e.message : String(e);
};

export class TimelineStore {
    project: TProjectDto | null = null;
    readonly chapters = observable.map<string, TChapterDto>({}, { deep: false });
    readonly triggers = observable.map<string, TTriggerDto>({}, { deep: false });
    layout: TTimelineLayoutDto | null = null;

    status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
    loadError: string | null = null;

    pps: number;
    showConnections: boolean;
    showTriggers: boolean;
    characterId: string | null;
    selected: TTimelineSelection;
    // makes the view re-sync after a rollback that changed no DTO
    revision = 0;

    readonly savedCamera: TTimelineCamera | null;

    private queues = new Map<string, Promise<unknown>>();
    private disposers: (() => void)[] = [];
    private cameraTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        readonly api: TVisualizerApi,
        readonly events: ApiEvents,
        readonly deps: TTimelineDeps
    ) {
        const toggles = { ...DEFAULT_TOGGLES, ...getUiState<Partial<TToggles>>(UI_KEYS.toggles, {}) };
        this.pps = clampPxPerSecond(Number(toggles.pps) || DEFAULT_PX_PER_SECOND);
        this.showConnections = toggles.showConnections !== false;
        this.showTriggers = toggles.showTriggers !== false;
        this.characterId = typeof toggles.characterId === 'string' ? toggles.characterId : null;
        this.selected = getUiState<TTimelineSelection>(UI_KEYS.selected, null);
        const camera = getUiState<TTimelineCamera | null>(UI_KEYS.camera, null);
        this.savedCamera =
            camera && Number.isFinite(camera.x) && Number.isFinite(camera.y) ? { x: camera.x, y: camera.y } : null;

        makeAutoObservable<this, 'queues' | 'disposers' | 'cameraTimer'>(this, {
            api: false,
            events: false,
            // replaced, never mutated; plain objects go straight into request bodies
            layout: observable.ref,
            project: observable.ref,
            selected: observable.ref,
            deps: false,
            savedCamera: false,
            queues: false,
            disposers: false,
            cameraTimer: false,
            load: false,
            start: false,
            dispose: false,
            commitChapter: false,
            commitTrigger: false,
            deleteSelected: false,
            createChapter: false,
            createTrigger: false,
            updateTrigger: false,
            refetchChapter: false,
            refetchTrigger: false,
            refetchLayout: false,
            reconcileProject: false,
        });
    }

    timeToX = (seconds: number) => timeToX(seconds, this.pps);
    xToTime = (x: number) => xToTime(x, this.pps);

    setPps = (pps: number) => {
        this.pps = clampPxPerSecond(pps);
        this.saveToggles();
        return this.pps;
    };

    chapterRange = (chapterId: string) => {
        const dto = this.chapters.get(chapterId);
        return dto ? parseRange(dto.timeRange) : null;
    };

    triggerTime = (triggerId: string) => parseTime(this.triggers.get(triggerId)?.time);

    chapterTitle = (chapterId: string) => {
        const dto = this.chapters.get(chapterId);
        return dto ? displayText(dto.title, chapterId) : chapterId;
    };

    get chapterIds(): string[] {
        const order = this.project?.chapters.map((c) => c.id) ?? [];
        const known = order.filter((id) => this.chapters.has(id));
        const rest = [...this.chapters.keys()].filter((id) => !order.includes(id));
        return [...known, ...rest];
    }

    chapterY = (chapterId: string): number => {
        const saved = this.layout?.chapters[chapterId]?.y;
        if (typeof saved === 'number' && Number.isFinite(saved)) return saved;
        return Math.max(0, this.chapterIds.indexOf(chapterId)) * DEFAULT_ROW_HEIGHT;
    };

    chapterCharacterIds = (chapterId: string): string[] => {
        const dto = this.chapters.get(chapterId);
        if (dto) return dto.characters.map((c) => c.characterId);
        return this.project?.chapters.find((c) => c.id === chapterId)?.characterIds ?? [];
    };

    isChapterVisible = (chapterId: string) =>
        this.characterId === null || this.chapterCharacterIds(chapterId).includes(this.characterId);

    get connections(): { from: string; to: string }[] {
        const out: { from: string; to: string }[] = [];
        for (const [id, dto] of this.chapters) {
            if (!Array.isArray(dto.children)) continue;
            for (const child of dto.children) {
                if (typeof child.chapterId === 'string' && this.chapters.has(child.chapterId)) {
                    out.push({ from: id, to: child.chapterId });
                }
            }
        }
        return out;
    }

    get unplaced(): { chapters: string[]; triggers: string[] } {
        return {
            chapters: [...this.chapters.keys()].filter((id) => this.chapterRange(id) === null),
            triggers: [...this.triggers.keys()].filter((id) => this.triggerTime(id) === null),
        };
    }

    get characters() {
        return this.project?.characters ?? [];
    }

    select = (selection: TTimelineSelection) => {
        this.selected = selection;
        setUiState(UI_KEYS.selected, selection ?? undefined);
    };

    toggleConnections = () => {
        this.showConnections = !this.showConnections;
        this.saveToggles();
    };

    toggleTriggers = () => {
        this.showTriggers = !this.showTriggers;
        if (!this.showTriggers && this.selected?.kind === 'trigger') this.select(null);
        this.saveToggles();
    };

    setCharacter = (characterId: string | null) => {
        this.characterId = characterId;
        if (this.selected?.kind === 'chapter' && !this.isChapterVisible(this.selected.id)) this.select(null);
        this.saveToggles();
    };

    saveCamera = (camera: TTimelineCamera) => {
        if (this.cameraTimer) clearTimeout(this.cameraTimer);
        this.cameraTimer = setTimeout(() => {
            this.cameraTimer = null;
            setUiState(UI_KEYS.camera, camera);
        }, 200);
    };

    private saveToggles() {
        setUiState<TToggles>(UI_KEYS.toggles, {
            showConnections: this.showConnections,
            showTriggers: this.showTriggers,
            characterId: this.characterId,
            pps: this.pps,
        });
    }

    load = async () => {
        runInAction(() => {
            if (this.status !== 'ready') this.status = 'loading';
        });
        try {
            const [project, layout] = await Promise.all([this.api.getProject(), this.api.getTimelineLayout()]);
            // one unloadable chapter / trigger (e.g. 422) must not fail the whole timeline
            const [chapters, triggers] = await Promise.all([
                Promise.all(project.chapters.map((c) => this.api.getChapter(c.id).catch(() => null))),
                Promise.all(project.triggers.map((t) => this.api.getTrigger(t.id).catch(() => null))),
            ]);
            runInAction(() => {
                this.project = project;
                this.layout = layout;
                this.chapters.replace(chapters.filter((c) => c !== null).map((c) => [c.chapterId, c]));
                this.triggers.replace(triggers.filter((t) => t !== null).map((t) => [t.triggerId, t]));
                this.status = 'ready';
                this.loadError = null;
                this.dropStaleSelection();
            });
        } catch (e) {
            runInAction(() => {
                this.status = 'error';
                this.loadError = errorMessage(e);
            });
        }
    };

    start = () => {
        const offs = [
            this.events.subscribe('chapter', (e) => void this.onChapterEvent(e)),
            this.events.subscribe('trigger', (e) => void this.onTriggerEvent(e)),
            this.events.subscribe({ kind: 'layout', id: 'timeline' }, () => void this.refetchLayout()),
            this.events.subscribe('project', () => void this.reconcileProject()),
            this.events.onResync(() => void this.load()),
        ];
        const off = () => offs.splice(0).forEach((o) => o());
        this.disposers.push(off);
        return off;
    };

    dispose = () => {
        this.disposers.splice(0).forEach((d) => d());
        if (this.cameraTimer) clearTimeout(this.cameraTimer);
    };

    private onChapterEvent = async (e: TChangeEvent) => {
        if (e.op === 'deleted' || e.version === null) {
            this.removeChapter(e.id);
            await this.reconcileProject();
            return;
        }
        await this.refetchChapter(e.id);
        if (e.op === 'created') await this.reconcileProject();
    };

    private onTriggerEvent = async (e: TChangeEvent) => {
        if (e.id === '*') {
            // '*' = hand edit of a chapter's triggers.ts
            await this.reconcileProject();
            const ids = [...this.triggers.values()]
                .filter((t) => e.chapterId === undefined || t.chapterId === e.chapterId)
                .map((t) => t.triggerId);
            await Promise.all(ids.map((id) => this.refetchTrigger(id)));
            return;
        }
        // adding / removing a trigger also bumps its chapter's version
        const chapterId = e.chapterId ?? this.triggers.get(e.id)?.chapterId;
        if (e.op === 'deleted' || e.version === null) {
            runInAction(() => this.removeTrigger(e.id));
            await Promise.all([this.reconcileProject(), chapterId && this.refetchChapter(chapterId)]);
            return;
        }
        await this.refetchTrigger(e.id);
        if (e.op === 'created') {
            await Promise.all([this.reconcileProject(), chapterId && this.refetchChapter(chapterId)]);
        }
    };

    refetchChapter = async (chapterId: string) => {
        try {
            const dto = await this.api.getChapter(chapterId);
            runInAction(() => this.chapters.set(chapterId, dto));
        } catch (e) {
            if (e instanceof ApiError && e.isNotFound) this.removeChapter(chapterId);
        }
    };

    refetchTrigger = async (triggerId: string) => {
        try {
            const dto = await this.api.getTrigger(triggerId);
            runInAction(() => this.triggers.set(triggerId, dto));
        } catch (e) {
            if (e instanceof ApiError && e.isNotFound) runInAction(() => this.removeTrigger(triggerId));
        }
    };

    refetchLayout = async () => {
        try {
            const layout = await this.api.getTimelineLayout();
            runInAction(() => (this.layout = layout));
        } catch {
            // keep the last layout
        }
    };

    reconcileProject = async () => {
        let project: TProjectDto;
        try {
            project = await this.api.getProject();
        } catch {
            return;
        }
        runInAction(() => (this.project = project));
        const chapterIds = new Set(project.chapters.map((c) => c.id));
        const triggerIds = new Set(project.triggers.map((t) => t.id));
        runInAction(() => {
            for (const id of [...this.chapters.keys()]) if (!chapterIds.has(id)) this.removeChapter(id);
            for (const id of [...this.triggers.keys()]) if (!triggerIds.has(id)) this.removeTrigger(id);
        });
        await Promise.all([
            ...[...chapterIds].filter((id) => !this.chapters.has(id)).map((id) => this.refetchChapter(id)),
            ...[...triggerIds].filter((id) => !this.triggers.has(id)).map((id) => this.refetchTrigger(id)),
        ]);
    };

    private removeChapter = action((chapterId: string) => {
        this.chapters.delete(chapterId);
        if (this.selected?.kind === 'chapter' && this.selected.id === chapterId) this.select(null);
    });

    private removeTrigger(triggerId: string) {
        this.triggers.delete(triggerId);
        if (this.selected?.kind === 'trigger' && this.selected.id === triggerId) this.select(null);
    }

    private dropStaleSelection() {
        const s = this.selected;
        if (!s) return;
        const exists = s.kind === 'chapter' ? this.chapters.has(s.id) : this.triggers.has(s.id);
        if (!exists) this.select(null);
    }

    private enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.queues.get(key) ?? Promise.resolve();
        const next = (async () => {
            await prev;
            return fn();
        })();
        this.queues.set(
            key,
            next.catch(() => undefined)
        );
        return next;
    }

    commitChapter = async (chapterId: string, next: { start?: number; end?: number; y?: number }) => {
        const tasks: Promise<unknown>[] = [];
        const range = this.chapterRange(chapterId);
        if (range && (next.start !== undefined || next.end !== undefined)) {
            const start = Math.round(next.start ?? range.start);
            const end = Math.max(start, Math.round(next.end ?? range.end));
            if (start !== range.start || end !== range.end) {
                tasks.push(this.saveChapterRange(chapterId, start, end));
            }
        }
        if (next.y !== undefined && Math.round(next.y) !== this.chapterY(chapterId)) {
            tasks.push(this.saveChapterY(chapterId, Math.round(next.y)));
        }
        if (tasks.length === 0) runInAction(() => this.revision++); // snap the box back
        await Promise.all(tasks);
    };

    private saveChapterRange(chapterId: string, start: number, end: number) {
        const before = this.chapters.get(chapterId);
        if (!before) return Promise.resolve();
        const timeRange = { start: formatTime(start), end: formatTime(end) };
        runInAction(() => this.chapters.set(chapterId, { ...before, timeRange }));
        return this.enqueue(`chapter:${chapterId}`, async () => {
            const version = this.chapters.get(chapterId)?.version ?? before.version;
            try {
                const saved = await this.api.updateChapter(chapterId, { version, timeRange });
                runInAction(() => this.chapters.set(chapterId, saved));
            } catch (e) {
                this.rejectEdit(e, _('Chapter %s', chapterId), () => {
                    if (e instanceof ApiError && e.isStale) {
                        const current = e.current as TChapterDto | null;
                        if (current) this.chapters.set(chapterId, current);
                        else this.removeChapter(chapterId);
                    } else {
                        // an earlier queued save may have advanced the version since `before`
                        const latest = this.chapters.get(chapterId);
                        if (latest) this.chapters.set(chapterId, { ...latest, timeRange: before.timeRange });
                    }
                });
            }
        });
    }

    // one file for all chapters: on stale, re-apply this y onto the fresh file once
    private saveChapterY(chapterId: string, y: number) {
        const apply = (layout: TTimelineLayoutDto | null): TTimelineLayoutDto => ({
            version: layout?.version ?? '',
            triggers: layout?.triggers ?? {},
            chapters: { ...(layout?.chapters ?? {}), [chapterId]: { y } },
        });
        runInAction(() => (this.layout = apply(this.layout)));
        return this.enqueue('layout', async () => {
            const put = async (layout: TTimelineLayoutDto) => {
                const saved = await this.api.updateTimelineLayout(apply(layout));
                runInAction(() => (this.layout = saved));
            };
            let error: unknown;
            try {
                await put(this.layout ?? apply(null));
                return;
            } catch (e) {
                error = e;
            }
            if (error instanceof ApiError && error.isStale) {
                try {
                    await put(apply(await this.api.getTimelineLayout()));
                    return;
                } catch (e) {
                    error = e;
                }
            }
            this.rejectEdit(error, _('Timeline layout'), () => void this.refetchLayout());
        });
    }

    commitTrigger = async (triggerId: string, seconds: number) => {
        const before = this.triggers.get(triggerId);
        const time = Math.round(seconds);
        if (!before || this.triggerTime(triggerId) === time) {
            runInAction(() => this.revision++);
            return;
        }
        const formatted = formatTime(time);
        runInAction(() => this.triggers.set(triggerId, { ...before, time: formatted }));
        await this.enqueue(`trigger:${triggerId}`, async () => {
            const version = this.triggers.get(triggerId)?.version ?? before.version;
            try {
                const saved = await this.api.updateTrigger(triggerId, { version, time: formatted });
                runInAction(() => this.triggers.set(triggerId, saved));
            } catch (e) {
                this.rejectEdit(e, _('Trigger %s', triggerId), () => {
                    if (e instanceof ApiError && e.isStale) {
                        const current = e.current as TTriggerDto | null;
                        if (current) this.triggers.set(triggerId, current);
                        else this.removeTrigger(triggerId);
                    } else {
                        // an earlier queued save may have advanced the version since `before`
                        const latest = this.triggers.get(triggerId);
                        if (latest) this.triggers.set(triggerId, { ...latest, time: before.time });
                    }
                });
            }
        });
    };

    updateTrigger = async (triggerId: string, body: TUpdateTriggerBody) => {
        const saved = await this.enqueue(`trigger:${triggerId}`, () => this.api.updateTrigger(triggerId, body));
        runInAction(() => this.triggers.set(triggerId, saved));
        return saved;
    };

    private rejectEdit(e: unknown, what: string, rollback: () => void) {
        runInAction(() => {
            rollback();
            this.revision++;
        });
        if (e instanceof ApiError && e.isStale) {
            this.deps.notify(_('%s changed on disk; reloaded it, your change was not saved.', what), 'warning');
        } else {
            this.deps.notify(_('%s: saving failed. %s', what, errorMessage(e)), 'error');
        }
    }

    deleteSelected = async () => {
        const selection = this.selected;
        if (!selection) return false;
        const isChapter = selection.kind === 'chapter';
        const trigger = isChapter ? undefined : this.triggers.get(selection.id);
        const dto = isChapter ? this.chapters.get(selection.id) : trigger;
        if (!dto) return false;
        const name = trigger ? displayText(trigger.name, selection.id) : this.chapterTitle(selection.id);
        const ok = await this.deps.confirm({
            title: isChapter ? _('Delete chapter %s?', name) : _('Delete trigger %s?', name),
            message: isChapter
                ? _('This deletes the chapter "%s" with all of its passages.', selection.id)
                : _('This deletes the time trigger "%s".', selection.id),
            danger: true,
        });
        if (!ok) return false;
        try {
            await this.enqueue(`${selection.kind}:${selection.id}`, () => {
                const version =
                    (isChapter ? this.chapters.get(selection.id) : this.triggers.get(selection.id))?.version ??
                    dto.version;
                return isChapter
                    ? this.api.deleteChapter(selection.id, { version })
                    : this.api.deleteTrigger(selection.id, { version });
            });
            runInAction(() => {
                if (isChapter) this.removeChapter(selection.id);
                else this.removeTrigger(selection.id);
            });
            void this.reconcileProject();
            // its chapter's triggers list (and version) changed
            if (trigger) await this.refetchChapter(trigger.chapterId);
            return true;
        } catch (e) {
            if (e instanceof ApiError && e.isReferenced) {
                this.deps.showReferences(_('%s is still referenced', name), e.references);
            } else if (e instanceof ApiError && e.isStale) {
                const current = e.current as TChapterDto | TTriggerDto | null;
                runInAction(() => {
                    if (!current) {
                        if (isChapter) this.removeChapter(selection.id);
                        else this.removeTrigger(selection.id);
                    } else if (isChapter) this.chapters.set(selection.id, current as TChapterDto);
                    else this.triggers.set(selection.id, current as TTriggerDto);
                });
                this.deps.notify(_('%s changed on disk; reloaded it, nothing was deleted.', name), 'warning');
            } else {
                this.deps.notify(_('Deleting %s failed. %s', name, errorMessage(e)), 'error');
            }
            return false;
        }
    };

    createChapter = async (body: { chapterId: string; location: string; start: number; title?: string }) => {
        const start = Math.round(body.start);
        const dto = await this.api.createChapter({
            chapterId: body.chapterId,
            title: body.title || body.chapterId,
            location: body.location,
            timeRange: { start: formatTime(start), end: formatTime(start + 24 * 3600) },
        });
        runInAction(() => {
            this.chapters.set(dto.chapterId, dto);
            this.select({ kind: 'chapter', id: dto.chapterId });
        });
        void this.reconcileProject();
        return dto;
    };

    createTrigger = async (body: { chapterId: string; triggerId: string; time: number; name?: string }) => {
        const dto = await this.api.createTrigger(body.chapterId, {
            triggerId: body.triggerId,
            name: body.name || body.triggerId,
            time: formatTime(Math.round(body.time)),
        });
        runInAction(() => {
            this.triggers.set(dto.triggerId, dto);
            if (!this.showTriggers) this.showTriggers = true;
            this.select({ kind: 'trigger', id: dto.triggerId });
        });
        void this.reconcileProject();
        await this.refetchChapter(body.chapterId); // its triggerIds and version changed
        return dto;
    };

    openChapter = (chapterId: string) => this.deps.openChapter(chapterId);
}

export const toastNotify = (message: string, variant: TToastVariant = 'info') => showToast(message, { variant });
