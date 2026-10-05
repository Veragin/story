import { useState } from 'react';
import {
    IconButton,
    InputBase,
    styled,
    TextField,
    Tooltip,
} from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Close from '@mui/icons-material/Close';
import { spacingCss } from '@story/ui';
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
        <SRoot role="list" aria-label={ariaLabel}>
            {value.map((row, index) => {
                const problem = valueProblem(
                    row.value,
                    values.filter((_v, i) => i !== index)
                );
                const renamed =
                    row.original !== null && row.original !== row.value;
                return (
                    <Tooltip
                        key={rows.keys[index]}
                        title={
                            problem ??
                            (renamed
                                ? _('Renamed from "%s"', row.original ?? '')
                                : row.original === null
                                  ? _('New value')
                                  : '')
                        }
                    >
                        <SChip
                            role="listitem"
                            data-value={row.value}
                            data-error={problem ? 'true' : undefined}
                            data-state={
                                renamed
                                    ? 'renamed'
                                    : row.original === null
                                      ? 'new'
                                      : undefined
                            }
                        >
                            <IconButton
                                size="small"
                                disabled={disabled || index === 0}
                                aria-label={_('Move %s left', row.value)}
                                data-action="move-left"
                                onClick={() => rows.move(index, index - 1)}
                            >
                                <ChevronLeft fontSize="inherit" />
                            </IconButton>
                            <SValue
                                value={row.value}
                                disabled={disabled}
                                onChange={(e) =>
                                    rows.set(index, {
                                        ...row,
                                        value: e.target.value,
                                    })
                                }
                                inputProps={{
                                    'aria-label': _('Value %d', index + 1),
                                    'size': Math.max(row.value.length, 2),
                                    'spellCheck': false,
                                }}
                            />
                            <IconButton
                                size="small"
                                disabled={
                                    disabled || index === value.length - 1
                                }
                                aria-label={_('Move %s right', row.value)}
                                data-action="move-right"
                                onClick={() => rows.move(index, index + 1)}
                            >
                                <ChevronRight fontSize="inherit" />
                            </IconButton>
                            <IconButton
                                size="small"
                                disabled={disabled}
                                aria-label={_('Remove %s', row.value)}
                                data-action="remove-value"
                                onClick={() => rows.remove(index)}
                            >
                                <Close fontSize="inherit" />
                            </IconButton>
                        </SChip>
                    </Tooltip>
                );
            })}
            <TextField
                size="small"
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
                inputProps={{
                    'aria-label': _('New value'),
                    'data-action': 'add-value',
                    'spellCheck': false,
                }}
            />
        </SRoot>
    );
};

const SRoot = styled('div')`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SChip = styled('div')`
    display: inline-flex;
    align-items: center;
    padding: 0 ${spacingCss(0.25)};
    border-radius: 16px;
    border: 1px solid ${({ theme }) => theme.palette.divider};
    background: ${({ theme }) => theme.palette.action.selected};
    &[data-state='new'],
    &[data-state='renamed'] {
        border-color: ${({ theme }) => theme.palette.info.main};
    }
    &[data-error='true'] {
        border-color: ${({ theme }) => theme.palette.error.main};
    }
`;

const SValue = styled(InputBase)`
    font-family: monospace;
    font-size: 13px;
    & input {
        padding: 2px 0;
    }
`;
