import { makeAutoObservable, observable, runInAction } from 'mobx';
import {
    BUILT_IN_REF_TARGETS,
    refTarget,
    type TCreateLiteralBody,
    type TCreateTypeBody,
    type TDataTypeDto,
    type TFieldDesc,
    type TLiteralDto,
    type TOkDto,
    type TStructTypeDto,
    type TStructureDto,
    type TUpdateLiteralBody,
    type TUpdateTypeBody,
    type TUpdateTypeDto,
    type TVersion,
} from '@story/visualizer-protocol';
import { ApiError, errorMessage, type ApiEvents, type TVisualizerApi } from '../api';
import { failureMessage, failureOf, type TWriteResult } from './writeResult';
import type { TOption } from '../components/inputs/inputTypes';
import type { IStructureContext } from '../components/inputs/structureContext';
import type { EntityStore } from './EntityStore';
import { RefCountedSubscription } from './RefCountedSubscription';

type TStructureStoreOptions = {
    api: TVisualizerApi;
    events?: ApiEvents;
    entities: EntityStore;
};

const EMPTY_STRUCTURE: TStructureDto = { version: '', literals: [], types: [] };

const replaceByName = <T extends { name: string }>(list: readonly T[], item: T): T[] =>
    list.some((x) => x.name === item.name) ? list.map((x) => (x.name === item.name ? item : x)) : [...list, item];

const withoutName = <T extends { name: string }>(list: readonly T[], name: string): T[] =>
    list.filter((x) => x.name !== name);

export class StructureStore implements IStructureContext {
    structure: TStructureDto | null = null;
    loading = false;
    error: string | null = null;
    // a refused write the author did not see as a returned result (the LiteralInput "+ Add" path)
    writeError: string | null = null;

    private readonly api: TVisualizerApi;
    private readonly events?: ApiEvents;
    private readonly entities: EntityStore;
    private readonly subscription: RefCountedSubscription;
    private loadToken = 0;

    constructor({ api, events, entities }: TStructureStoreOptions) {
        this.api = api;
        this.events = events;
        this.entities = entities;
        this.subscription = new RefCountedSubscription(() => this.subscribe());
        makeAutoObservable<StructureStore, 'api' | 'events' | 'entities' | 'subscription' | 'loadToken'>(
            this,
            {
                api: false,
                events: false,
                entities: false,
                subscription: false,
                loadToken: false,
                structure: observable.ref,
            },
            { autoBind: true }
        );
    }

    get loaded(): boolean {
        return this.structure !== null;
    }

    get literals(): readonly TLiteralDto[] {
        return this.structure?.literals ?? [];
    }

    get types(): readonly TStructTypeDto[] {
        return this.structure?.types ?? [];
    }

    get literalNames(): readonly string[] {
        return this.literals.map((literal) => literal.name);
    }

    get typeNames(): readonly string[] {
        return this.types.map((type) => type.name);
    }

    get storyTypes(): readonly TStructTypeDto[] {
        return this.types.filter((type) => type.origin === 'story');
    }

    get extendableTypes(): readonly TStructTypeDto[] {
        return this.types.filter((type) => type.origin === 'extendable');
    }

    get refTypeNames(): readonly string[] {
        return [...Object.keys(BUILT_IN_REF_TARGETS), ...this.types.filter((type) => type.catalog).map((t) => t.name)];
    }

    literal(name: string): TLiteralDto | undefined {
        return this.literals.find((literal) => literal.name === name);
    }

    literalValues(name: string): readonly string[] {
        return this.literal(name)?.values ?? [];
    }

    literalsVisibleFrom(file?: string): readonly TLiteralDto[] {
        return this.literals.filter((literal) => literal.scope === 'global' || literal.file === file);
    }

    type(name: string): TStructTypeDto | undefined {
        return this.types.find((type) => type.name === name);
    }

    // The entity's data type joins the world state as `Partial<…>`, so its fields are optional there.
    fieldsOf(typeName: string | null, dataType?: TDataTypeDto): TFieldDesc[] {
        const base = typeName ? (this.type(typeName)?.fields ?? []) : [];
        const keys = new Set(base.map((field) => field.key));
        const own = (dataType?.fields ?? [])
            .filter((field) => !keys.has(field.key))
            .map((field) => ({ ...field, optional: true }));
        return [...base, ...own];
    }

    userFieldsOf(typeName: string): TFieldDesc[] {
        return (this.type(typeName)?.fields ?? []).filter((field) => !field.locked);
    }

    refOptions(refName: string): readonly TOption[] {
        const target = refTarget(refName, this.structure ?? EMPTY_STRUCTURE);
        return target ? this.entities.optionsOf(target) : [];
    }

    // Returns the release; the subscription stays while any page holds it.
    start(): () => void {
        const fresh = !this.subscription.active;
        const release = this.subscription.acquire();
        if (fresh) void this.load();
        return release;
    }

    async load() {
        const token = ++this.loadToken;
        this.loading = true;
        try {
            const structure = await this.api.getStructure();
            runInAction(() => {
                if (token !== this.loadToken) return;
                this.structure = structure;
                this.error = null;
                this.entities.ensureCatalogs(structure.types.flatMap((type) => type.catalog?.name ?? []));
            });
        } catch (e) {
            runInAction(() => {
                if (token === this.loadToken) this.error = errorMessage(e);
            });
        } finally {
            runInAction(() => {
                if (token === this.loadToken) this.loading = false;
            });
        }
    }

    async addLiteralValue(name: string, value: string): Promise<boolean> {
        this.writeError = null;
        const result = await this.mutate(
            () => this.api.addLiteralValue(name, { value }),
            (literal) => this.patch({ literals: replaceByName(this.literals, literal) })
        );
        if (result.status === 'ok' || result.status === 'exists') return true;
        runInAction(() => {
            this.writeError = failureMessage(result, `Could not add "${value}" to ${name}`);
        });
        return false;
    }

    dismissWriteError() {
        this.writeError = null;
    }

    createType(body: TCreateTypeBody): Promise<TWriteResult<TStructTypeDto>> {
        return this.mutate(
            () => this.api.createType(body),
            (type) => this.patch({ types: replaceByName(this.types, type) })
        );
    }

    updateType(name: string, body: TUpdateTypeBody): Promise<TWriteResult<TUpdateTypeDto>> {
        return this.mutate(
            () => this.api.updateType(name, body),
            ({ type }) => this.patch({ types: replaceByName(this.types, type) })
        );
    }

    deleteType(name: string, version: TVersion): Promise<TWriteResult<TOkDto>> {
        return this.mutate(
            () => this.api.deleteType(name, { version }),
            () => this.patch({ types: withoutName(this.types, name) })
        );
    }

    createLiteral(body: TCreateLiteralBody): Promise<TWriteResult<TLiteralDto>> {
        return this.mutate(
            () => this.api.createLiteral(body),
            (literal) => this.patch({ literals: replaceByName(this.literals, literal) })
        );
    }

    updateLiteral(name: string, body: TUpdateLiteralBody): Promise<TWriteResult<TLiteralDto>> {
        return this.mutate(
            () => this.api.updateLiteral(name, body),
            (literal) => this.patch({ literals: replaceByName(this.literals, literal) })
        );
    }

    deleteLiteral(name: string, version: TVersion): Promise<TWriteResult<TOkDto>> {
        return this.mutate(
            () => this.api.deleteLiteral(name, { version }),
            () => this.patch({ literals: withoutName(this.literals, name) })
        );
    }

    // the local patch shows the change at once; the reload brings the new structure version
    private async mutate<T>(call: () => Promise<T>, apply: (value: T) => void): Promise<TWriteResult<T>> {
        try {
            const value = await call();
            runInAction(() => apply(value));
            void this.load();
            return { status: 'ok', value };
        } catch (e) {
            if (e instanceof ApiError && e.code === 'exists') void this.load();
            return failureOf(e);
        }
    }

    private patch(change: Partial<Pick<TStructureDto, 'literals' | 'types'>>) {
        if (this.structure) this.structure = { ...this.structure, ...change };
    }

    private subscribe() {
        if (!this.events) return [];
        return [this.events.subscribe('structure', () => void this.load()), this.events.onResync(this.load)];
    }
}
