import { Row } from 'code/components/Basic';
import { MapStore } from '../../MapStore';
import { Button, Tooltip } from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import { List } from './List';
import { TextField } from 'code/Visualizer/components/TextField';
import { useState } from 'react';
import { showToast } from 'code/GlobalWrapper';
import { spacingCss } from 'code/components/css';
import styled from '@emotion/styled';

type Props = {
    mapStore: MapStore;
    initId?: string;
    onBack: () => void;
};

export const AddNewColor = ({ mapStore, onBack, initId }: Props) => {
    const [id, setId] = useState(initId ?? '');
    const [name, setName] = useState(mapStore.data.palette[id]?.name ?? '');
    const [color, setColor] = useState(
        mapStore.data.palette[id]?.color ?? '#000000'
    );

    const onAdd = () => {
        if (!id || !name) {
            showToast(_('Please fill all fields'), {
                variant: 'error',
            });
            return;
        }
        mapStore.data.palette[id] = {
            color,
            name,
        };
        mapStore.setSelectedColorId(id);
        onBack();
    };

    return (
        <>
            <Row>
                <Tooltip title={_('Back')}>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={onBack}
                        fullWidth
                    >
                        <ArrowBackIosNewRoundedIcon />
                    </Button>
                </Tooltip>
                <Tooltip title={_('Create new color')}>
                    <Button
                        variant="contained"
                        size="small"
                        color={'success'}
                        onClick={onAdd}
                        fullWidth
                    >
                        <AddCircleRoundedIcon />
                    </Button>
                </Tooltip>
            </Row>
            <SList>
                <TextField
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    label={_('ID')}
                    variant="outlined"
                />
                <TextField
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    label={_('Name')}
                    variant="outlined"
                />
                <SInput
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                />
            </SList>
        </>
    );
};

const SList = styled(List)`
    gap: ${spacingCss(1)};
    padding: ${spacingCss(2)};
`;

const SInput = styled.input``;
