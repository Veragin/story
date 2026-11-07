import type { TCreateLiteralBody, TFieldDesc, TStructKind, TStructNameError } from '@story/protocol';

export type TStructureRow = { field: TFieldDesc; originalKey: string | null };

export type TNewLiteral = Omit<TCreateLiteralBody, 'file'>;

export type TLiteralDraft = {
    file?: string;
    owner?: string;
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

export const structNameMessage = (error: TStructNameError, kind: TStructKind = 'type'): string => {
    switch (error) {
        case 'required':
            return _('Enter a name');
        case 'pattern':
            return kind === 'class'
                ? _('A class name starts with a capital letter, not T and a capital, e.g. Race')
                : _('A name starts with T and a capital letter, e.g. TRace');
        case 'id':
            return _('Names ending in Id are reserved for ids');
        case 'reserved':
            return _('Item and Chapter are reserved names');
        case 'taken':
            return _('That name is already used');
    }
};
