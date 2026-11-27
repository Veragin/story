import { useState } from 'react';
import { FormHelperText, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { RowActions } from '../buttons/RowActions';
import { useRowList } from '../../hooks/useRowList';
import type { TInputProps } from './inputTypes';
import { TextInput } from './TextInput';
import { InlineRow } from '../layout/InlineRow';

type TProps = TInputProps<readonly string[], string[]> & {
    hintOf?: (index: number) => string | undefined;
    stateOf?: (index: number) => string | undefined;
    addPlaceholder?: string;
};

const itemProblem = (
    item: string,
    others: readonly string[]
): string | null => {
    if (item === '') return _('Empty value');
    return others.includes(item) ? _('Listed twice') : null;
};

export const StringListInput = ({
    value,
    onChange,
    hintOf = () => undefined,
    stateOf = () => undefined,
    addPlaceholder = _('Add a value, then Enter'),
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const rows = useRowList(value, onChange);
    const [adding, setAdding] = useState('');
    const addProblem =
        adding.trim() === '' ? null : itemProblem(adding.trim(), value);

    const add = () => {
        const next = adding.trim();
        if (next === '' || addProblem) return;
        rows.add(next);
        setAdding('');
    };

    return (
        <SList role="list" aria-label={ariaLabel} data-field={dataField}>
            {value.map((item, index) => {
                const problem = itemProblem(
                    item,
                    value.filter((_v, i) => i !== index)
                );
                const hint = problem ?? hintOf(index);
                return (
                    <InlineRow
                        key={rows.keys[index]}
                        role="listitem"
                        data-value={item}
                        data-error={problem ? 'true' : undefined}
                        data-state={stateOf(index)}
                    >
                        <div>
                            <TextInput
                                value={item}
                                onChange={(next) => rows.set(index, next)}
                                hasError={!!problem}
                                disabled={disabled}
                                ariaLabel={_('Value %d', index + 1)}
                            />
                            {hint && (
                                <FormHelperText error={!!problem}>
                                    {hint}
                                </FormHelperText>
                            )}
                        </div>
                        <RowActions
                            index={index}
                            count={value.length}
                            onMove={rows.move}
                            onRemove={rows.remove}
                            disabled={disabled}
                            rowLabel={item}
                        />
                    </InlineRow>
                );
            })}
            <TextInput
                value={adding}
                onChange={setAdding}
                onEnter={add}
                onBlur={add}
                hasError={!!addProblem}
                disabled={disabled}
                placeholder={addPlaceholder}
                ariaLabel={_('New value')}
                dataField="new-value"
            />
            {addProblem && <FormHelperText error>{addProblem}</FormHelperText>}
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
