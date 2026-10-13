import { observer } from 'mobx-react-lite';
import type { MapStore } from '../../MapStore';
import styled from '@emotion/styled';
import { Column } from '@story/ui';
import {
    WIDGET_BORDER_COLOR,
    WIDGET_BORDER_WIDTH,
} from '../../MapEngine/constants';
import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { AddNewColor } from './AddNewColor';
import { DeleteAlert } from './DeleteAlert';

type Props = {
    mapStore: MapStore;
};

export const Palette = observer(({ mapStore }: Props) => {
    const [addNewColor, setAddNewColor] = useState<null | undefined | string>(
        null
    );
    const [addDeleteColor, setDeleteColor] = useState(false);

    if (mapStore.tool !== 'paint' || !mapStore.data) return null;

    return (
        <SContainer>
            {addNewColor !== null && (
                <AddNewColor
                    mapStore={mapStore}
                    onBack={() => setAddNewColor(null)}
                    initId={addNewColor}
                />
            )}
            {addDeleteColor && (
                <DeleteAlert
                    mapStore={mapStore}
                    onBack={() => setDeleteColor(false)}
                />
            )}
            {addNewColor === null && !addDeleteColor && (
                <ColorPicker
                    mapStore={mapStore}
                    onAddNewColor={(id) => setAddNewColor(id)}
                    onDeleteColor={() => setDeleteColor(true)}
                />
            )}
        </SContainer>
    );
});

const SContainer = styled(Column)`
    position: absolute;
    top: 8px;
    left: 8px;
    width: 160px;
    max-height: 320px;
    z-index: 2;
    color: #fff;

    border: ${WIDGET_BORDER_WIDTH}px solid ${WIDGET_BORDER_COLOR};
    background-color: #000;
    border-radius: 6px;
    overflow: hidden;
`;
