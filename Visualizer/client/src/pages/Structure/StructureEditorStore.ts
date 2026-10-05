import { makeAutoObservable, reaction, runInAction } from 'mobx';
import type { TLiteralDto, TStructTypeDto, TVersion } from '@story/visualizer-protocol';
import {
    rowFields,
    rowRenames,
    structureRows,
    type TNewLiteral,
    type TStructureRow,
} from '../../components/inputs/StructureInput/structureRows';
import type { TStructureSection } from '../../shell';
import { DraftResource } from '../../stores/DraftResource';
import type { EntityStore } from '../../stores/EntityStore';
import type { StructureStore } from '../../stores/StructureStore';
import type { TWriteResult } from '../../stores/writeResult';
import { deepEqual } from '../../deepEqual';
import { touchedSummary } from './structureText';

export type TTypeDraft = { rows: TStructureRow[]; newLiterals: TNewLiteral[] };

export type TLiteralValueRow = { value: string; original: string | null };

const isStructType = (value: unknown): value is TStructTypeDto =>
    typeof value === 'object' && value !== null && 'origin' in value && 'fields' in value;

const isLiteral = (value: unknown): value is TLiteralDto =>
    typeof value === 'object' && value !== null && 'scope' in value && 'values' in value;

// diagnostics about the body itself, not about instances that stopped type-checking
const isBodyDiagnostic = (field: string | undefined) => field === 'name' || !!field?.startsWith('fields.');

const literalRows = (values: readonly string[]): TLiteralValueRow[] =>
    values.map((value) => ({ value, original: value }));

const literalRenames = (rows: readonly TLiteralValueRow[]): Record<string, string> =>
    Object.fromEntries(
        rows.flatMap(({ value, original }) => (original !== null && original !== value ? [[original, value]] : []))
    );

export class StructureEditorStore {
    section: TStructureSection = 'types';
    name: string | null = null;
    // the last failed type save was refused by instances, which a reset can fix
    canResetIncompatible = false;

    readonly structure: StructureStore;
    readonly entities: EntityStore;
    readonly type: DraftResource<TStructTypeDto, TTypeDraft>;
    readonly literal: DraftResource<TLiteralDto, TLiteralValueRow[]>;
    private resetIncompatible = false;

    constructor({ structure, entities }: { structure: StructureStore; entities: EntityStore }) {
        this.structure = structure;
        this.entities = entities;
        this.type = new DraftResource<TStructTypeDto, TTypeDraft>({
            toDraft: (base) => ({ rows: structureRows(base.fields), newLiterals: [] }),
            sameDraft: deepEqual,
            parseCurrent: (current) => (isStructType(current) ? current : null),
            write: (base, draft, version) => this.writeType(base, draft, version),
        });
        this.literal = new DraftResource<TLiteralDto, TLiteralValueRow[]>({
            toDraft: (base) => literalRows(base.values),
            sameDraft: deepEqual,
            parseCurrent: (current) => (isLiteral(current) ? current : null),
            write: (base, rows, version) =>
                this.structure.updateLiteral(base.name, {
                    version,
                    values: rows.map((row) => row.value),
                    renames: literalRenames(rows),
                }),
        });
        makeAutoObservable<StructureEditorStore, 'resetIncompatible'>(
            this,
            { structure: false, entities: false, type: false, literal: false, resetIncompatible: false },
            { autoBind: true }
        );
    }

    get selectedType(): TStructTypeDto | undefined {
        return this.section === 'types' && this.name ? this.structure.type(this.name) : undefined;
    }

    get selectedLiteral(): TLiteralDto | undefined {
        return this.section === 'literals' && this.name ? this.structure.literal(this.name) : undefined;
    }

    get notFound(): boolean {
        const resource = this.section === 'types' ? this.type : this.literal;
        const current = this.section === 'types' ? this.selectedType : this.selectedLiteral;
        return this.name !== null && this.structure.loaded && !current && !resource.base;
    }

    start(): () => void {
        const release = this.structure.start();
        const stop = reaction(
            () => [this.selectedType, this.selectedLiteral],
            () => this.sync(),
            { fireImmediately: true }
        );
        return () => {
            stop();
            release();
        };
    }

    show(section: TStructureSection, name?: string) {
        const next = name ?? null;
        if (section === this.section && next === this.name) return;
        this.section = section;
        this.name = next;
        this.canResetIncompatible = false;
        this.type.reset();
        this.literal.reset();
        this.sync();
    }

    setRows(rows: TStructureRow[]) {
        const draft = this.type.draft;
        if (draft) this.type.edit({ ...draft, rows });
    }

    addNewLiteral(literal: TNewLiteral) {
        const draft = this.type.draft;
        if (draft) this.type.edit({ ...draft, newLiterals: [...draft.newLiterals, literal] });
    }

    setLiteralRows(rows: TLiteralValueRow[]) {
        this.literal.edit(rows);
    }

    async saveTypeResetting(): Promise<boolean> {
        this.resetIncompatible = true;
        try {
            return await this.type.save();
        } finally {
            runInAction(() => {
                this.resetIncompatible = false;
            });
        }
    }

    removeType(): Promise<boolean> {
        return this.type.remove((base) => this.structure.deleteType(base.name, base.version));
    }

    removeLiteral(): Promise<boolean> {
        return this.literal.remove((base) => this.structure.deleteLiteral(base.name, base.version));
    }

    private sync() {
        if (this.section === 'types') this.syncResource(this.type, this.selectedType);
        else this.syncResource(this.literal, this.selectedLiteral);
    }

    private syncResource<T extends { version: TVersion }, D>(resource: DraftResource<T, D>, current: T | undefined) {
        if (!this.structure.loaded || !this.name) return;
        if (!resource.base && !resource.stale) {
            if (current) resource.load(current);
            return;
        }
        resource.external(current ?? null);
    }

    // new local literals first: they go into the type's file, so its version moves
    private async writeType(
        base: TStructTypeDto,
        draft: TTypeDraft,
        version: TVersion
    ): Promise<TWriteResult<TStructTypeDto>> {
        runInAction(() => {
            this.canResetIncompatible = false;
        });
        let current = version;
        const pending = draft.newLiterals.filter((literal) => !this.structure.literal(literal.name));
        for (const literal of pending) {
            const created = await this.structure.createLiteral({ ...literal, file: base.file });
            if (created.status !== 'ok') return created;
        }
        if (pending.length > 0) {
            await this.structure.load();
            const fresh = this.structure.type(base.name);
            if (!fresh || !deepEqual(fresh.fields, base.fields)) return { status: 'stale', current: fresh ?? null };
            current = fresh.version;
        }
        const result = await this.structure.updateType(base.name, {
            version: current,
            fields: rowFields(draft.rows),
            renames: rowRenames(draft.rows),
            ...(this.resetIncompatible ? { resetIncompatible: true } : {}),
        });
        if (result.status !== 'ok') {
            runInAction(() => {
                this.canResetIncompatible =
                    result.status === 'invalid' && result.diagnostics.some((d) => !isBodyDiagnostic(d.field));
            });
            return result;
        }
        this.type.showInfo(touchedSummary(result.value.touchedFiles));
        return { status: 'ok', value: result.value.type };
    }
}
