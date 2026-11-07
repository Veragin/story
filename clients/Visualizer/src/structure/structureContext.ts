import { createSafeContext } from '@story/ui';
import {
    BUILT_IN_REF_TARGETS,
    structFieldsOf,
    type TFieldDesc,
    type TLiteralDto,
    type TStructTypeDto,
    type TStructureDto,
    type TTypeDefaultContext,
} from '@story/protocol';
import type { TOption } from './option';

export interface IStructureContext {
    readonly literalNames: readonly string[];
    readonly typeNames: readonly string[];
    readonly refTypeNames: readonly string[];
    literalValues: (name: string) => readonly string[];
    structFields: (name: string) => readonly TFieldDesc[];
    structNamesVisibleFrom: (file?: string) => readonly string[];
    literalsVisibleFrom: (file?: string) => readonly TLiteralDto[];
    addLiteralValue: (name: string, value: string) => Promise<boolean>;
    refOptions: (refName: string) => readonly TOption[];
}

export const refTypeNamesOf = (types: readonly TStructTypeDto[]): string[] => [
    ...Object.keys(BUILT_IN_REF_TARGETS),
    ...types.filter((type) => type.kind === 'class' && type.catalog).map((type) => type.name),
];

// a private type is usable only in its owner's file
export const structNamesVisibleIn = (types: readonly TStructTypeDto[], file?: string): string[] =>
    types
        .filter((type) => type.kind === 'type' && type.origin === 'story' && (!type.owner || type.file === file))
        .map((type) => type.name);

export const privateOwnerOf = (type: TStructTypeDto): string | undefined =>
    type.owner ?? (type.kind === 'class' && type.file.startsWith('types/') ? type.name : undefined);

export const [StructureContext, useStructureContext] = createSafeContext<IStructureContext>('StructureContext');

export const typeContextOf = (structure: IStructureContext): TTypeDefaultContext => ({
    literalValues: (name) => structure.literalValues(name),
    idsOf: (refName) => structure.refOptions(refName).map((option) => option.id),
    structFields: (name) => structure.structFields(name),
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
    refTypeNames: refTypeNamesOf(structure.types),
    literalValues: (name) => structure.literals.find((literal) => literal.name === name)?.values ?? [],
    structFields: (name) => structFieldsOf(structure, name),
    structNamesVisibleFrom: (file) => structNamesVisibleIn(structure.types, file),
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
    structFields: (name) => structure.structFields(name),
    structNamesVisibleFrom: (file) => structure.structNamesVisibleFrom(file),
    literalsVisibleFrom: (file) => structure.literalsVisibleFrom(file),
    addLiteralValue: (name, value) => structure.addLiteralValue(name, value),
    refOptions: (name) =>
        name === refName ? structure.refOptions(name).filter((option) => option.id !== id) : structure.refOptions(name),
});
