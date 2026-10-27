import { useState } from 'react';
import styled from '@emotion/styled';
import { Button, TextField } from '@mui/material';
import { Row, showToast, spacingCss } from '@story/ui';
import type { MapStore } from '../../MapStore';
import { ColorSwatchInput } from '../../../components/ColorSwatchInput';
import { ToolSection } from '../ToolWindow/ToolSection';

type Props = {
    mapStore: MapStore;
    initId?: string;
    onBack: () => void;
};

export const AddNewColor = ({ mapStore, onBack, initId }: Props) => {
    const [id, setId] = useState(initId ?? '');
    const [name, setName] = useState(mapStore.data?.palette[id]?.name ?? '');
    const [color, setColor] = useState(
        mapStore.data?.palette[id]?.color ?? '#ff0000'
    );

    const onAdd = () => {
        if (!id || !name) {
            showToast(_('Please fill all fields'), {
                variant: 'error',
            });
            return;
        }
        if (!/^[A-Za-z0-9_]+$/.test(id)) {
            showToast(_('The id may only contain letters, digits and _'), {
                variant: 'error',
            });
            return;
        }
        mapStore.setPaletteColor(id, { color, name });
        onBack();
    };

    return (
        <ToolSection label={initId ? _('Edit color') : _('Add new color')}>
            <TextField
                value={id}
                onChange={(e) => setId(e.target.value)}
                label={_('ID')}
                variant="outlined"
                size="small"
            />
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
                />
            </SRow>
            <SButtons>
                <Button size="small" color="inherit" onClick={onBack}>
                    {_('Back')}
                </Button>
                <Button size="small" variant="contained" onClick={onAdd}>
                    {initId ? _('Save') : _('Create')}
                </Button>
            </SButtons>
        </ToolSection>
    );
};

const SRow = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SButtons = styled(Row)`
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;
