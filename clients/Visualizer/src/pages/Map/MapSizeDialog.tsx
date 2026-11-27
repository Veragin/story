import { useState } from 'react';
import { DialogContentText } from '@mui/material';
import { STORY_LIMITS } from '@story/protocol';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { FormNumberInput } from '../../components/form/FormNumberInput';
import {
    DEFAULT_MAP_HEIGHT,
    DEFAULT_MAP_WIDTH,
} from '../../MapEditor/createDefaultMapData';
import type { TMapSize } from './MapPageStore';

const sideError = (n: number) => {
    const { mapSizeMin, mapSizeMax } = STORY_LIMITS;
    if (!Number.isInteger(n) || n < mapSizeMin || n > mapSizeMax) {
        return _('A whole number from %d to %d', mapSizeMin, mapSizeMax);
    }
    return null;
};

type TProps = {
    locationName: string;
    onConfirm: (size: TMapSize) => void;
    onClose: () => void;
};

export const MapSizeDialog = ({
    locationName,
    onConfirm,
    onClose,
}: TProps) => {
    const [width, setWidth] = useState(DEFAULT_MAP_WIDTH);
    const [height, setHeight] = useState(DEFAULT_MAP_HEIGHT);
    const widthError = sideError(width);
    const heightError = sideError(height);
    const valid = widthError === null && heightError === null;

    return (
        <AppDialog
            title={_('Add a map of %s', locationName)}
            size="xs"
            onClose={onClose}
            onSubmit={() => {
                if (valid) onConfirm({ width, height });
            }}
            actions={
                <DialogButtons
                    onClose={onClose}
                    label={_('Add map')}
                    disabled={!valid}
                    submit
                />
            }
        >
            <DialogContentText>
                {_('The size of the map, in tiles.')}
            </DialogContentText>
            <FormNumberInput
                label={_('Width')}
                value={width}
                onChange={(next = width) => setWidth(next)}
                error={widthError}
                dataField="width"
            />
            <FormNumberInput
                label={_('Height')}
                value={height}
                onChange={(next = height) => setHeight(next)}
                error={heightError}
                dataField="height"
            />
        </AppDialog>
    );
};
