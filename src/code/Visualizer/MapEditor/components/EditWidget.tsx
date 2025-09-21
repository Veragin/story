import { observer } from 'mobx-react-lite';
import { MapStore } from '../MapStore';
import styled from '@emotion/styled';
import { Column, Row } from 'code/components/Basic';
import {
    WIDGET_BORDER_COLOR,
    WIDGET_BORDER_WIDTH,
} from '../MapEngine/constants';
import { TextField } from 'code/Visualizer/components/TextField';
import { runInAction } from 'mobx';
import { spacingCss } from 'code/components/css';
import { SmallText } from 'code/components/Text';
import { Select } from 'code/Visualizer/components/Select';

type Props = {
    mapStore: MapStore;
};

export const EditWidget = observer(({ mapStore }: Props) => {
    const selectedTile = mapStore.selectedTile;
    if (mapStore.mode !== 'edit' || !selectedTile) return null;

    const tile = mapStore.data.data[selectedTile.i][selectedTile.j];

    const findMap = () =>
        mapStore.data.maps.find(
            (m) => m.i === selectedTile.i && m.j === selectedTile.j
        );
    const map = findMap();

    const onMapChange = (mapId?: string) => {
        if (!mapId) {
            mapStore.data.maps = mapStore.data.maps.filter(
                (m) => m.i !== selectedTile.i || m.j !== selectedTile.j
            );
            return;
        }

        const map = findMap();
        if (map) {
            map.mapId = mapId;
        } else {
            mapStore.data.maps.push({
                i: selectedTile.i,
                j: selectedTile.j,
                mapId: mapId,
            });
        }
    };

    return (
        <SContainer>
            <SRow>
                <SmallText>i: {selectedTile.i}</SmallText>
                <SmallText>j: {selectedTile.j}</SmallText>
            </SRow>
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
            <Select
                value={map?.mapId ?? ''}
                label={_('Map')}
                onChange={(v) => onMapChange(v === '' ? undefined : v)}
                options={[
                    { label: '-', value: '' },
                    { label: 'Village', value: 'village' },
                    { label: 'Forest', value: 'forest' },
                    { label: 'Castle', value: 'castle' },
                    { label: 'Cave', value: 'cave' },
                    { label: 'Desert', value: 'desert' },
                    { label: 'Mountain', value: 'mountain' },
                    { label: 'Swamp', value: 'swamp' },
                ]}
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

    padding: ${spacingCss(2)} ${spacingCss(1)};
    gap: ${spacingCss(2)};
`;

const SRow = styled(Row)`
    gap: ${spacingCss(3)};
    align-self: stretch;
    justify-content: center;
`;
