import { observer } from 'mobx-react-lite';
import { MapStore } from '../MapStore';
import styled from '@emotion/styled';
import { Column } from 'code/components/Basic';
import {
    WIDGET_BORDER_COLOR,
    WIDGET_BORDER_WIDTH,
} from '../MapEngine/constants';
import { TextField } from 'code/Visualizer/components/TextField';
import { runInAction } from 'mobx';

type Props = {
    mapStore: MapStore;
};

export const EditWidget = observer(({ mapStore }: Props) => {
    if (mapStore.mode !== 'edit' || !mapStore.selectedTile) return null;

    const tile =
        mapStore.data.data[mapStore.selectedTile.i][mapStore.selectedTile.j];
    return (
        <SContainer>
            <TextField
                value={tile.label}
                onChange={(e) =>
                    runInAction(() => {
                        tile.label = e.target.value;
                    })
                }
                label={_('Label')}
                variant="outlined"
            />
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
