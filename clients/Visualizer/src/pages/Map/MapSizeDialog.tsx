import { useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    TextField,
} from '@mui/material';
import styled from '@emotion/styled';
import { STORY_LIMITS } from '@story/protocol';
import { Row, spacingCss } from '@story/ui';
import {
    DEFAULT_MAP_HEIGHT,
    DEFAULT_MAP_WIDTH,
} from '../../MapEditor/createDefaultMapData';
import type { TMapSize } from './MapPageStore';

const sideError = (text: string) => {
    const n = Number(text);
    const { mapSizeMin, mapSizeMax } = STORY_LIMITS;
    if (
        text.trim() === '' ||
        !Number.isInteger(n) ||
        n < mapSizeMin ||
        n > mapSizeMax
    ) {
        return _('A whole number from %d to %d', mapSizeMin, mapSizeMax);
    }
    return null;
};

export const MapSizeDialog = ({
    locationName,
    onAnswer,
}: {
    locationName: string;
    onAnswer: (size: TMapSize | null) => void;
}) => {
    const [width, setWidth] = useState(String(DEFAULT_MAP_WIDTH));
    const [height, setHeight] = useState(String(DEFAULT_MAP_HEIGHT));
    const widthError = sideError(width);
    const heightError = sideError(height);
    const valid = widthError === null && heightError === null;

    return (
        <Dialog open onClose={() => onAnswer(null)} maxWidth="xs" fullWidth>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (valid)
                        onAnswer({
                            width: Number(width),
                            height: Number(height),
                        });
                }}
            >
                <DialogTitle>{_('Add a map of %s', locationName)}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {_('The size of the map, in tiles.')}
                    </DialogContentText>
                    <SFields>
                        <TextField
                            label={_('Width')}
                            type="number"
                            value={width}
                            onChange={(e) => setWidth(e.target.value)}
                            error={widthError !== null}
                            helperText={widthError}
                            size="small"
                            autoFocus
                        />
                        <TextField
                            label={_('Height')}
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            error={heightError !== null}
                            helperText={heightError}
                            size="small"
                        />
                    </SFields>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={() => onAnswer(null)}>
                        {_('Cancel')}
                    </Button>
                    <Button type="submit" variant="contained" disabled={!valid}>
                        {_('Add map')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

const SFields = styled(Row)`
    gap: ${spacingCss(2)};
    padding-top: ${spacingCss(2)};
    align-items: flex-start;
`;
