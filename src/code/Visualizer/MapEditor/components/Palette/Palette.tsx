import { observer } from 'mobx-react-lite';
import { MapStore } from '../../MapStore';
import styled from '@emotion/styled';
import { Column } from 'code/components/Basic';
import {
    WIDGET_BORDER_COLOR,
    WIDGET_BORDER_WIDTH,
} from '../../MapEngine/constants';
import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { AddNewColor } from './AddNewColor';

type Props = {
    mapStore: MapStore;
};

export const Palette = observer(({ mapStore }: Props) => {
    const [addNewColor, setAddNewColor] = useState<null | undefined | string>(
        null
    );
    const [addDeleteColor, setDeleteColor] = useState(false);

    if (mapStore.showPalette === false) return null;

    return (
        <SContainer>
            {addNewColor !== null && (
                <AddNewColor
                    mapStore={mapStore}
                    onBack={() => setAddNewColor(null)}
                    initId={addNewColor}
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
    top: 50px;
    left: 0;
    width: 150px;
    max-height: 300px;

    border: ${WIDGET_BORDER_WIDTH}px solid ${WIDGET_BORDER_COLOR};
    background-color: #000;
    border-radius: 6px;
    overflow: hidden;
`;
