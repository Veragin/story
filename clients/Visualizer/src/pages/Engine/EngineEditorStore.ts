import { makeAutoObservable, runInAction } from 'mobx';
import {
    ENGINE_SECTIONS,
    isEngineSection,
    type TChangeEvent,
    type TDiagnosticDto,
    type TEngineSection,
    type TEngineSectionDto,
} from '@story/protocol';
import { errorMessage, type ApiEvents, type TVisualizerApi } from '../../api';
import { DraftResource } from '../../stores/DraftResource';
import { writeResult } from '../../stores/writeResult';
import { deepEqual } from '../../deepEqual';
import { ENGINE_SECTION_INFO } from './engineSections';

export type TEngineDraft = { description: string; code: string };

type TEngineEditorOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
};

// TypeScript's parser errors; their positions are relative to the code we sent
const isSyntaxError = (d: TDiagnosticDto) => d.code !== undefined && d.code < 2000;

const isEngineSectionDto = (value: unknown): value is TEngineSectionDto =>
    typeof value === 'object' &&
    value !== null &&
    'section' in value &&
    typeof value.section === 'string' &&
    isEngineSection(value.section) &&
    'implemented' in value;

const toDraft = (base: TEngineSectionDto): TEngineDraft => ({ description: base.description, code: base.code });

export class EngineEditorStore {
    section: TEngineSection = ENGINE_SECTIONS[0];
    sections: Partial<Record<TEngineSection, TEngineSectionDto>> = {};
    loaded = false;
    implementing = false;

    readonly resource: DraftResource<TEngineSectionDto, TEngineDraft>;
    private readonly api: TVisualizerApi;
    private readonly events?: ApiEvents;
    private offs: (() => void)[] = [];

    constructor({ api, events }: TEngineEditorOptions) {
        this.api = api;
        this.events = events;
        this.resource = new DraftResource<TEngineSectionDto, TEngineDraft>({
            toDraft,
            sameDraft: deepEqual,
            parseCurrent: (current) => (isEngineSectionDto(current) ? current : null),
            write: (base, draft, version) =>
                writeResult(() => this.api.updateEngineSection(base.section, { version, ...draft })),
            onChange: () => this.remember(),
        });
        makeAutoObservable<EngineEditorStore, 'api' | 'events' | 'offs'>(
            this,
            { resource: false, api: false, events: false, offs: false },
            { autoBind: true }
        );
    }

    get selected(): TEngineSectionDto | undefined {
        return this.sections[this.section];
    }

    get codeOpen(): boolean {
        const { base, draft } = this.resource;
        if (!base || !draft) return false;
        return this.implementing || base.implemented || draft.code !== base.code;
    }

    get codeDiagnostics(): TDiagnosticDto[] {
        const file = this.resource.base?.file;
        return this.resource.diagnostics.filter((d) => d.file === file && isSyntaxError(d));
    }

    get hasTypeErrors(): boolean {
        return this.resource.diagnostics.some((d) => !isSyntaxError(d));
    }

    start(): () => void {
        if (this.offs.length === 0 && this.events) {
            this.offs.push(
                this.events.subscribe('engine', this.onEngineEvent),
                this.events.onResync(() => void this.loadAll())
            );
        }
        void this.loadAll();
        return this.dispose;
    }

    dispose() {
        this.offs.splice(0).forEach((off) => off());
    }

    show(section: TEngineSection) {
        if (section === this.section) return;
        this.section = section;
        this.implementing = false;
        this.resource.reset();
        const current = this.selected;
        if (current) this.resource.load(current);
    }

    setDescription(description: string) {
        const draft = this.resource.draft;
        if (draft) this.resource.edit({ ...draft, description });
    }

    setCode(code: string) {
        const draft = this.resource.draft;
        if (draft) this.resource.edit({ ...draft, code });
    }

    implementManually() {
        const { base, draft } = this.resource;
        if (!base || !draft) return;
        this.implementing = true;
        if (!base.implemented && draft.code === base.code) {
            this.resource.edit({ ...draft, code: ENGINE_SECTION_INFO[base.section].starter });
        }
    }

    async remove(): Promise<boolean> {
        const removed: { dto?: TEngineSectionDto } = {};
        const ok = await this.resource.remove(async (base) => {
            const result = await writeResult(() =>
                this.api.updateEngineSection(base.section, { version: base.version, delete: true })
            );
            if (result.status !== 'ok') return result;
            removed.dto = result.value;
            return { status: 'ok', value: { ok: true } };
        });
        const missing = removed.dto;
        if (ok && missing) {
            runInAction(() => {
                this.sections[missing.section] = missing;
                if (missing.section === this.section) {
                    this.implementing = false;
                    this.resource.load(missing);
                }
            });
        }
        return ok;
    }

    async loadAll() {
        await Promise.all(ENGINE_SECTIONS.map((section) => this.refresh(section)));
        runInAction(() => {
            this.loaded = true;
        });
    }

    async refresh(section: TEngineSection) {
        let current: TEngineSectionDto;
        try {
            current = await this.api.getEngineSection(section);
        } catch (e) {
            if (section === this.section) runInAction(() => this.resource.showError(errorMessage(e)));
            return;
        }
        runInAction(() => {
            this.sections[section] = current;
            if (section === this.section) this.sync(current);
        });
    }

    private sync(current: TEngineSectionDto) {
        const resource = this.resource;
        if (!resource.base && !resource.stale) resource.load(current);
        else resource.external(current);
    }

    private remember() {
        const base = this.resource.base;
        if (base) this.sections[base.section] = base;
    }

    private onEngineEvent(event: TChangeEvent) {
        if (isEngineSection(event.id)) void this.refresh(event.id);
        else void this.loadAll();
    }
}
