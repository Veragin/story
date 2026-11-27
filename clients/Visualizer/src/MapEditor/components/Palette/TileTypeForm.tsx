import { useState, type FormEvent } from 'react';
import { Button } from '@mui/material';
import type { MapStore } from '../../MapStore';
import { isPaletteNameTaken } from '../../palette';
import { FormColorInput } from '../../../components/form/FormColorInput';
import { FormFields } from '../../../components/form/FormFields';
import { FormTextInput } from '../../../components/form/FormTextInput';
import { ActionRow } from '../../../components/layout/ActionRow';
import { PanelSection } from '../../../components/layout/PanelSection';

type TProps = {
    mapStore: MapStore;
    editId?: string;
    onBack: () => void;
};

export const TileTypeForm = ({ mapStore, onBack, editId }: TProps) => {
    const palette = mapStore.data?.palette ?? {};
    const initial = editId ? palette[editId] : undefined;
    const [name, setName] = useState(initial?.name ?? '');
    const [color, setColor] = useState(initial?.color ?? '#ff0000');

    const trimmedName = name.trim();
    const nameTaken = isPaletteNameTaken(palette, trimmedName, editId);
    const valid = trimmedName !== '' && !nameTaken;

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        const entry = { color, name: trimmedName };
        if (editId) mapStore.setPaletteColor(editId, entry);
        else mapStore.addPaletteColor(entry);
        onBack();
    };

    return (
        <PanelSection label={editId ? _('Edit tile type') : undefined}>
            <FormFields as="form" onSubmit={onSubmit}>
                <FormColorInput
                    label={_('Color')}
                    value={color}
                    onChange={(next = color) => setColor(next)}
                />
                <FormTextInput
                    label={_('Name')}
                    value={name}
                    onChange={(next = '') => setName(next)}
                    autoFocus
                    error={nameTaken ? _('This name is already used') : null}
                    dataField="name"
                />
                <ActionRow>
                    <Button color="inherit" size="small" onClick={onBack}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        size="small"
                        disabled={!valid}
                    >
                        {editId ? _('Save') : _('Create')}
                    </Button>
                </ActionRow>
            </FormFields>
        </PanelSection>
    );
};
