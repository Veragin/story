import type { TLiteralValueRow } from './StructureEditorStore';

const removedIndex = (rows: readonly TLiteralValueRow[], values: readonly string[]) => {
    const index = rows.findIndex((row, i) => row.value !== values[i]);
    return index === -1 ? rows.length - 1 : index;
};

const followValues = (rows: readonly TLiteralValueRow[], values: readonly string[]): TLiteralValueRow[] => {
    const left = [...rows];
    return values.map((value) => {
        const at = left.findIndex((row) => row.value === value);
        return at === -1 ? { value, original: null } : left.splice(at, 1)[0];
    });
};

// the list reports only values; one changed value is a rename, several are a move
export const literalRowsWithValues = (
    rows: readonly TLiteralValueRow[],
    values: readonly string[]
): TLiteralValueRow[] => {
    if (values.length > rows.length)
        return [...rows, ...values.slice(rows.length).map((value) => ({ value, original: null }))];
    if (values.length < rows.length) {
        const removed = removedIndex(rows, values);
        return rows.filter((_row, i) => i !== removed);
    }
    const changed = rows.flatMap((row, i) => (row.value === values[i] ? [] : [i]));
    if (changed.length === 1) return rows.map((row, i) => (i === changed[0] ? { ...row, value: values[i] } : row));
    return followValues(rows, values);
};

export const renamedHint = (row: TLiteralValueRow | undefined) =>
    row && row.original !== null && row.original !== row.value ? _('Renamed from "%s"', row.original) : undefined;

export const literalRowState = (row: TLiteralValueRow | undefined) => {
    if (!row) return undefined;
    if (row.original === null) return 'new';
    return row.original === row.value ? undefined : 'renamed';
};
