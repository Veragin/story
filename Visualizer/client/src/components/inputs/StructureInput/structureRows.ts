import type { TCreateLiteralBody, TFieldDesc, TStructNameError } from '@story/visualizer-protocol';

export type TStructureRow = { field: TFieldDesc; originalKey: string | null };

export type TNewLiteral = Omit<TCreateLiteralBody, 'file'>;

export type TLiteralDraft = {
    file?: string;
    newLiterals?: readonly TNewLiteral[];
    onNewLiteral?: (literal: TNewLiteral) => void;
};

export const structureRows = (fields: readonly TFieldDesc[]): TStructureRow[] =>
    fields.map((field) => ({ field, originalKey: field.key }));

export const rowFields = (rows: readonly TStructureRow[]): TFieldDesc[] => rows.map((row) => row.field);

export const rowRenames = (rows: readonly TStructureRow[]): Record<string, string> =>
    Object.fromEntries(
        rows.flatMap(({ field, originalKey }) =>
            originalKey !== null && originalKey !== field.key ? [[originalKey, field.key]] : []
        )
    );

export const structNameMessage = (error: TStructNameError): string => {
    switch (error) {
        case 'required':
            return _('Enter a name');
        case 'pattern':
            return _('A name starts with T and a capital letter, e.g. TRace');
        case 'id':
            return _('Names ending in Id are reserved for ids');
        case 'taken':
            return _('That name is already used');
    }
};
