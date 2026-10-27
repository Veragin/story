import { useState, type FormEvent } from 'react';
import styled from '@emotion/styled';
import { Button, TextField } from '@mui/material';
import { Row, spacingCss } from '@story/ui';
import type { MapStore } from '../../MapStore';
import { isPaletteNameTaken } from '../../palette';
import { ColorSwatchInput } from '../../../components/ColorSwatchInput';
import { ToolSection } from '../ToolWindow/ToolSection';

type Props = {
    mapStore: MapStore;
    editId?: string;
    onBack: () => void;
};

export const TileTypeForm = ({ mapStore, onBack, editId }: Props) => {
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
        <ToolSection label={editId ? _('Edit tile type') : undefined}>
            <SForm onSubmit={onSubmit}>
                <SRow>
                    <ColorSwatchInput
                        label={_('Color')}
                        value={color}
                        onChange={setColor}
                        size={36}
                    />
                    <TextField
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        label={_('Name')}
                        variant="outlined"
                        size="small"
                        fullWidth
                        autoFocus
                        error={nameTaken}
                        helperText={
                            nameTaken
                                ? _('This name is already used')
                                : undefined
                        }
                    />
                </SRow>
                <SButtons>
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
                </SButtons>
            </SForm>
        </ToolSection>
    );
};

const SForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
`;

const SRow = styled(Row)`
    align-items: flex-start;
    gap: ${spacingCss(1)};
`;

const SButtons = styled(Row)`
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;
