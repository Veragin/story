import type { ReactNode } from 'react';
import { Button, styled } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { spacingCss } from '@story/ui';
import {
    inferTypeRef,
    isCode,
    typeDefault,
    type TMaybeCode,
    type TTypeRef,
    type TValue,
} from '@story/visualizer-protocol';
import { CodeValue } from './CodeValue';
import {
    nestedDiagnostics,
    NO_DIAGNOSTICS,
    type TDiagnosticsOf,
    type TInputProps,
} from './inputTypes';
import { useTypeContext } from './structureContext';
import { useRowList } from './useRowList';
import { isValueArray, parseAs } from './valueSource';
import { RowActions } from './RowActions';
import { ValueInput } from './ValueInput';

const parseArray = parseAs(isValueArray);
const UNTYPED_ITEM: TTypeRef = { t: 'string' };

type TProps = TInputProps<TMaybeCode<TValue[]>, TValue[]> & {
    itemType?: TTypeRef;
    renderItem?: (
        item: TValue,
        onChange: (value: TValue) => void,
        index: number
    ) => ReactNode;
    diagnosticsOf?: TDiagnosticsOf;
    newItem?: () => TValue;
};

const newItemType = (items: TValue[]): TTypeRef => {
    if (items.length === 0) return UNTYPED_ITEM;
    const inferred = inferTypeRef(items);
    return inferred.t === 'array' ? inferred.of : UNTYPED_ITEM;
};

export const ArrayInput = ({
    value,
    onChange,
    itemType,
    renderItem,
    diagnosticsOf = NO_DIAGNOSTICS,
    newItem,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const items = isCode(value) ? [] : value;
    const rows = useRowList(items, onChange);
    const typeContext = useTypeContext();

    if (isCode(value)) {
        return (
            <CodeValue
                code={value.code}
                parse={parseArray}
                fallback={[]}
                onChange={onChange}
                hasError={hasError}
                disabled={disabled}
                ariaLabel={ariaLabel}
            />
        );
    }

    const add = () =>
        rows.add(
            newItem
                ? newItem()
                : typeDefault(itemType ?? newItemType(items), typeContext)
        );

    return (
        <SList data-field={dataField} aria-label={ariaLabel} role="list">
            {items.map((item, index) => {
                const rowLabel = `${ariaLabel} ${index + 1}`;
                const change = (next: TValue) => rows.set(index, next);
                return (
                    <SRow key={rows.keys[index]} role="listitem">
                        <SItem>
                            {renderItem ? (
                                renderItem(item, change, index)
                            ) : (
                                <ValueInput
                                    type={itemType ?? inferTypeRef(item)}
                                    value={item}
                                    onChange={change}
                                    ariaLabel={rowLabel}
                                    hasError={
                                        diagnosticsOf(String(index)).length > 0
                                    }
                                    diagnosticsOf={nestedDiagnostics(
                                        diagnosticsOf,
                                        index
                                    )}
                                    disabled={disabled}
                                />
                            )}
                        </SItem>
                        <RowActions
                            index={index}
                            count={items.length}
                            onMove={rows.move}
                            onRemove={rows.remove}
                            disabled={disabled}
                            rowLabel={rowLabel}
                        />
                    </SRow>
                );
            })}
            <SAdd>
                <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={disabled}
                    data-action="add-item"
                    onClick={add}
                >
                    {_('Add')}
                </Button>
            </SAdd>
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

const SAdd = styled('div')`
    display: flex;
`;
