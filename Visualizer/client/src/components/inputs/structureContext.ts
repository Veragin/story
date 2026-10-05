import { createSafeContext } from '@story/ui';
import {
    BUILT_IN_REF_TARGETS,
    type TLiteralDto,
    type TStructureDto,
    type TTypeDefaultContext,
} from '@story/visualizer-protocol';
import type { TOption } from './inputTypes';

export interface IStructureContext {
    readonly literalNames: readonly string[];
    readonly typeNames: readonly string[];
    readonly refTypeNames: readonly string[];
    literalValues: (name: string) => readonly string[];
    literalsVisibleFrom: (file?: string) => readonly TLiteralDto[];
    addLiteralValue: (name: string, value: string) => Promise<boolean>;
    refOptions: (refName: string) => readonly TOption[];
}

export const [StructureContext, useStructureContext] = createSafeContext<IStructureContext>('StructureContext');

export const typeContextOf = (structure: IStructureContext): TTypeDefaultContext => ({
    literalValues: (name) => structure.literalValues(name),
    idsOf: (refName) => structure.refOptions(refName).map((option) => option.id),
});

export const useTypeContext = (): TTypeDefaultContext => typeContextOf(useStructureContext());

const refusedLiteralValue = () => Promise.resolve(false);

export const staticStructureContext = (
    structure: TStructureDto,
    options: Readonly<Record<string, readonly TOption[]>> = {},
    addLiteralValue: IStructureContext['addLiteralValue'] = refusedLiteralValue
): IStructureContext => ({
    literalNames: structure.literals.map((literal) => literal.name),
    typeNames: structure.types.map((type) => type.name),
    refTypeNames: [
        ...Object.keys(BUILT_IN_REF_TARGETS),
        ...structure.types.filter((type) => type.catalog).map((type) => type.name),
    ],
    literalValues: (name) => structure.literals.find((literal) => literal.name === name)?.values ?? [],
    literalsVisibleFrom: (file) =>
        structure.literals.filter((literal) => literal.scope === 'global' || literal.file === file),
    addLiteralValue,
    refOptions: (refName) => options[refName] ?? [],
});

export const withoutRefOption = (structure: IStructureContext, refName: string, id: string): IStructureContext => ({
    get literalNames() {
        return structure.literalNames;
    },
    get typeNames() {
        return structure.typeNames;
    },
    get refTypeNames() {
        return structure.refTypeNames;
    },
    literalValues: (name) => structure.literalValues(name),
    literalsVisibleFrom: (file) => structure.literalsVisibleFrom(file),
    addLiteralValue: (name, value) => structure.addLiteralValue(name, value),
    refOptions: (name) =>
        name === refName ? structure.refOptions(name).filter((option) => option.id !== id) : structure.refOptions(name),
});
