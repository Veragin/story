import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Column, Row, SmallText, spacingCss } from '@story/ui';
import { MapStore } from '../MapStore';
import {
    WIDGET_BORDER_COLOR,
    WIDGET_BORDER_WIDTH,
} from '../MapEngine/constants';
import { TextField } from '../../components/TextField';

type Props = {
    mapStore: MapStore;
};

/**
 * Tile tooling of the select tool: the selected tile's label (drawn on the tile) and its free-text
 * description of the environment (drawn under the label when zoomed in far enough).
 */
export const EditWidget = observer(({ mapStore }: Props) => {
    const selectedTile = mapStore.selectedTile;
    // re-render on every edit and on live refresh: the document itself is not observable
    void mapStore.revision;
    if (mapStore.tool !== 'select') return null;

    const tile = selectedTile ? mapStore.getTile(selectedTile) : undefined;
    if (!selectedTile || !tile) {
        return (
            <SContainer>
                <SmallText>
                    {_('Click a tile to edit its label and description.')}
                </SmallText>
            </SContainer>
        );
    }
    const color = mapStore.data?.palette[tile.tile];

    return (
        <SContainer data-testid="tile-edit-widget">
            <SRow>
                <SmallText>i: {selectedTile.i}</SmallText>
                <SmallText>j: {selectedTile.j}</SmallText>
                <SmallText>{color?.name ?? tile.tile}</SmallText>
            </SRow>
            <TextField
                value={tile.label ?? ''}
                onChange={(e) =>
                    mapStore.setTileText(selectedTile, {
                        label: e.target.value,
                    })
                }
                label={_('Label')}
                variant="outlined"
                size="small"
            />
            <TextField
                value={tile.description ?? ''}
                onChange={(e) =>
                    mapStore.setTileText(selectedTile, {
                        description: e.target.value,
                    })
                }
                label={_('Description')}
                variant="outlined"
                size="small"
                multiline
                minRows={3}
                maxRows={10}
            />
        </SContainer>
    );
});

const SContainer = styled(Column)`
    position: absolute;
    top: ${spacingCss(1)};
    left: ${spacingCss(1)};
    width: 240px;
    max-height: calc(100% - 16px);
    overflow: auto;
    z-index: 2;

    border: ${WIDGET_BORDER_WIDTH}px solid ${WIDGET_BORDER_COLOR};
    background-color: #000;
    color: #fff;
    border-radius: 6px;

    padding: ${spacingCss(2)} ${spacingCss(1)};
    gap: ${spacingCss(2)};
    align-items: stretch;
`;

const SRow = styled(Row)`
    gap: ${spacingCss(2)};
    justify-content: center;
`;
