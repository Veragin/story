import { styled } from '@mui/material';
import { AddButton } from '../../buttons/AddButton';
import { spacingCss } from '@story/ui';
import { freeFieldKey } from '../../../structure/fieldKey';
import type { TInputProps } from '../../inputs/inputTypes';
import { useRowList } from '../../../hooks/useRowList';
import { StructureRow } from './StructureRow';
import type {
    TLiteralDraft,
    TStructureRow,
} from '../../../structure/structureRows';

type TProps = TInputProps<readonly TStructureRow[], TStructureRow[]> & {
    literals?: TLiteralDraft;
};

export const StructureEditor = ({
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
                <AddButton
                    label={_('Add field')}
                    disabled={disabled}
                    data-action="add-structure-field"
                    onClick={add}
                />
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
