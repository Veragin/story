import { Row } from 'code/components/Basic';
import { MapStore } from '../../MapStore';
import { Button, Tooltip } from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
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
        mapStore.data.palette[id]?.color ?? '#ff0000'
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
                <SLabel>
                    {_('Color')}
                    <SInput
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                    />
                    <SColor $color={color} />
                </SLabel>
            </SList>
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
                        <AddRoundedIcon />
                    </Button>
                </Tooltip>
            </Row>
        </>
    );
};

const SList = styled(List)`
    gap: ${spacingCss(2)};
    padding: ${spacingCss(2)};
`;

const SLabel = styled.label`
    font-size: 14px;
    cursor: pointer;
`;

const SInput = styled.input`
    visibility: hidden;
    height: 0;
`;

const SColor = styled.div<{ $color: string }>`
    background-color: ${({ $color }) => $color};
    width: 100%;
    height: 25px;
    border-radius: 6px;
    margin-top: 4px;
`;
