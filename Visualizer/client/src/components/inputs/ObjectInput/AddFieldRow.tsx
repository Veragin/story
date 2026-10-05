import { useState } from 'react';
import { Button, styled, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { spacingCss } from '@story/ui';
import type { TTypeRef } from '@story/visualizer-protocol';
import { fieldKeyError } from '../fieldKey';
import { FieldTypePicker } from '../StructureInput/FieldTypePicker';

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
            <TextField
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
                sx={{ width: 160, flexShrink: 0 }}
            />
            <FieldTypePicker
                value={type}
                onChange={setType}
                disabled={disabled}
                ariaLabel={_('New field')}
            />
            <Button
                size="small"
                startIcon={<AddIcon fontSize="small" />}
                disabled={!canAdd}
                data-action="add-custom-field"
                onClick={add}
                sx={{ flexShrink: 0, mt: 0.5 }}
            >
                {_('Add field')}
            </Button>
        </SRow>
    );
};

const SRow = styled('div')`
    display: flex;
    align-items: flex-start;
    gap: ${spacingCss(0.5)};
`;
