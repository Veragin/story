import { useState } from 'react';
import { styled, TextField } from '@mui/material';
import { spacingCss } from '@story/ui';
import { InputDiagnostics } from '../../components/inputs/InputDiagnostics';
import { RowActions } from '../../components/inputs/RowActions';
import { StringInput } from '../../components/inputs/StringInput';
import { useRowList } from '../../components/inputs/useRowList';
import type { TLiteralValueRow } from './StructureEditorStore';

type TProps = {
    value: readonly TLiteralValueRow[];
    onChange: (rows: TLiteralValueRow[]) => void;
    disabled?: boolean;
    ariaLabel: string;
};

const valueProblem = (
    value: string,
    others: readonly string[]
): string | null => {
    if (value === '') return _('Empty value');
    return others.includes(value) ? _('Listed twice') : null;
};

const rowState = (row: TLiteralValueRow) => {
    if (row.original === null) return 'new';
    return row.original === row.value ? undefined : 'renamed';
};

export const LiteralValuesInput = ({
    value,
    onChange,
    disabled,
    ariaLabel,
}: TProps) => {
    const rows = useRowList(value, onChange);
    const [adding, setAdding] = useState('');
    const values = value.map((row) => row.value);
    const addProblem =
        adding.trim() === '' ? null : valueProblem(adding.trim(), values);

    const add = () => {
        const next = adding.trim();
        if (next === '' || addProblem) return;
        rows.add({ value: next, original: null });
        setAdding('');
    };

    return (
        <SList role="list" aria-label={ariaLabel}>
            {value.map((row, index) => {
                const rowLabel = _('Value %d', index + 1);
                const problem = valueProblem(
                    row.value,
                    values.filter((_v, i) => i !== index)
                );
                const state = rowState(row);
                return (
                    <SRow
                        key={rows.keys[index]}
                        role="listitem"
                        data-value={row.value}
                        data-error={problem ? 'true' : undefined}
                        data-state={state}
                    >
                        <SItem>
                            <StringInput
                                value={row.value}
                                onChange={(next) =>
                                    rows.set(index, { ...row, value: next })
                                }
                                hasError={!!problem}
                                disabled={disabled}
                                ariaLabel={rowLabel}
                            />
                            {problem ? (
                                <InputDiagnostics messages={[problem]} />
                            ) : (
                                state === 'renamed' && (
                                    <SHint>
                                        {_(
                                            'Renamed from "%s"',
                                            row.original ?? ''
                                        )}
                                    </SHint>
                                )
                            )}
                        </SItem>
                        <RowActions
                            index={index}
                            count={value.length}
                            onMove={rows.move}
                            onRemove={rows.remove}
                            disabled={disabled}
                            rowLabel={row.value}
                        />
                    </SRow>
                );
            })}
            <TextField
                size="small"
                fullWidth
                value={adding}
                disabled={disabled}
                placeholder={_('Add a value, then Enter')}
                error={!!addProblem}
                helperText={addProblem ?? undefined}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    add();
                }}
                onBlur={add}
                slotProps={{
                    htmlInput: {
                        'aria-label': _('New value'),
                        'data-action': 'add-value',
                        'spellCheck': false,
                    },
                }}
            />
        </SList>
    );
};

const SList = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    min-width: 0;
    width: 100%;
`;

const SRow = styled('div')`
    display: flex;
    align-items: flex-start;
    gap: ${spacingCss(0.5)};
`;

const SItem = styled('div')`
    flex: 1;
    min-width: 0;
`;

const SHint = styled('div')`
    margin-top: 2px;
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
`;
