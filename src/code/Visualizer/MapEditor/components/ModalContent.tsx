import styled from '@emotion/styled';
import { Column, Row } from 'code/components/Basic';
import { TextField } from '../../components/TextField';
import { useState } from 'react';
import { Button } from '@mui/material';

type Props = {
    initId?: string;
    onSubmit: (id: string, name: string, w: number, h: number) => void;
};

export const ModalContent = ({ onSubmit, initId }: Props) => {
    const [id, setId] = useState(initId ?? '');
    const [name, setName] = useState('');
    const [width, setWidth] = useState(100);
    const [height, setHeight] = useState(100);

    return (
        <SColumn>
            <TextField
                value={id}
                onChange={(e) => setId(e.target.value)}
                label={_('Map id')}
                color="info"
                variant="outlined"
                fullWidth
            />
            <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                label={_('Map name')}
                variant="outlined"
                fullWidth
            />
            <TextField
                value={width}
                onChange={(e) =>
                    setWidth(
                        isNaN(parseInt(e.target.value))
                            ? 0
                            : parseInt(e.target.value)
                    )
                }
                label={_('Map width')}
                variant="outlined"
                fullWidth
            />
            <TextField
                value={height}
                onChange={(e) =>
                    setHeight(
                        isNaN(parseInt(e.target.value))
                            ? 0
                            : parseInt(e.target.value)
                    )
                }
                label={_('Map height')}
                variant="outlined"
                fullWidth
            />
            <SRow>
                <Button
                    onClick={() => onSubmit(id, name, width, height)}
                    variant="contained"
                >
                    {_('Create')}
                </Button>
            </SRow>
        </SColumn>
    );
};

const SColumn = styled(Column)`
    gap: 16px;
    color: white;
`;

const SRow = styled(Row)`
    align-self: stretch;
    justify-content: end;
`;
