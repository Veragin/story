import { useState } from 'react';
import { styled, TextField } from '@mui/material';
import { AddButton } from '../../buttons/AddButton';
import { spacingCss } from '@story/ui';
import type { TTypeRef } from '@story/protocol';
import { fieldKeyError } from '../../../structure/fieldKey';
import { FieldTypePicker } from '../StructureEditor/FieldTypePicker';

type TProps = {
    existingKeys: readonly string[];
    onAdd: (key: string, type: TTypeRef) => void;
    disabled?: boolean;
};

const INITIAL_TYPE: TTypeRef = { t: 'string' };

export const AddFieldRow = ({ existingKeys, onAdd, disabled }: TProps) => {
    const [key, setKey] = useState('');
    const [type, setType] = useState<TTypeRef>(INITIAL_TYPE);
    const error = fieldKeyError(key, existingKeys);
    const canAdd = key !== '' && !error && !disabled;
    const add = () => {
        if (!canAdd) return;
        onAdd(key, type);
        setKey('');
    };

    return (
        <SRow data-add-field>
            <SKeyField
                size="small"
                value={key}
                error={!!error}
                helperText={error ?? undefined}
                disabled={disabled}
                placeholder={_('New field')}
                slotProps={{
                    htmlInput: {
                        'aria-label': _('New field name'),
                        'data-field': 'new-field-key',
                    },
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') add();
                }}
                onChange={(e) => setKey(e.target.value.trim())}
            />
            <FieldTypePicker
                value={type}
                onChange={setType}
                disabled={disabled}
                ariaLabel={_('New field')}
            />
            <SAddButton
                label={_('Add field')}
                disabled={!canAdd}
                data-action="add-custom-field"
                onClick={add}
            />
        </SRow>
    );
};

const SRow = styled('div')`
    display: flex;
    align-items: flex-start;
    gap: ${spacingCss(0.5)};
`;

const SKeyField = styled(TextField)`
    width: 160px;
    flex-shrink: 0;
`;

const SAddButton = styled(AddButton)`
    flex-shrink: 0;
    margin-top: ${spacingCss(0.5)};
`;
