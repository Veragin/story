import { Button, styled } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { spacingCss } from '@story/ui';
import { freeFieldKey } from '../fieldKey';
import type { TInputProps } from '../inputTypes';
import { useRowList } from '../useRowList';
import { StructureRow } from './StructureRow';
import type { TLiteralDraft, TStructureRow } from './structureRows';

type TProps = TInputProps<readonly TStructureRow[], TStructureRow[]> & {
    literals?: TLiteralDraft;
};

export const StructureInput = ({
    value,
    onChange,
    literals,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const rows = useRowList(value, onChange);
    const keys = value.map((row) => row.field.key);
    const add = () =>
        rows.add({
            field: {
                key: freeFieldKey('field', keys),
                type: { t: 'string' },
                optional: false,
            },
            originalKey: null,
        });

    return (
        <SList role="list" aria-label={ariaLabel} data-field={dataField}>
            {value.map((row, index) => (
                <StructureRow
                    key={rows.keys[index]}
                    row={row}
                    onChange={(next) => rows.set(index, next)}
                    otherKeys={keys.filter((_key, i) => i !== index)}
                    index={index}
                    count={value.length}
                    onMove={rows.move}
                    onRemove={rows.remove}
                    literals={literals}
                    disabled={disabled}
                />
            ))}
            <SAdd>
                <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={disabled}
                    data-action="add-structure-field"
                    onClick={add}
                >
                    {_('Add field')}
                </Button>
            </SAdd>
        </SList>
    );
};

const SList = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    min-width: 0;
    width: 100%;
`;

const SAdd = styled('div')`
    display: flex;
`;
