import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import {
    IconButton,
    Slider,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material';
import BrushIcon from '@mui/icons-material/Brush';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import MapIcon from '@mui/icons-material/Map';
import { Row, SmallText, spacingCss } from '@story/ui';
import { MapStore } from '../MapStore';
import { MAX_BRUSH_SIZE } from '../MapEngine/constants';
import type { TTileTool } from '../types';

/** The tooling row of the page's `tiles` mode (the mapMaker tools). */
export const TileToolbar = observer(({ mapStore }: { mapStore: MapStore }) => {
    const hover = mapStore.hoverTile;
    void mapStore.revision;
    const tile = hover ? mapStore.getTile(hover) : undefined;
    const color = tile ? mapStore.data?.palette[tile.tile] : undefined;

    return (
        <>
            <ToggleButtonGroup
                size="small"
                exclusive
                value={mapStore.tool}
                onChange={(_e, tool: TTileTool | null) =>
                    tool && mapStore.setTool(tool)
                }
            >
                <ToggleButton value="paint" aria-label={_('Paint tiles')}>
                    <Tooltip title={_('Paint tiles with the palette colour')}>
                        <BrushIcon fontSize="small" />
                    </Tooltip>
                </ToggleButton>
                <ToggleButton value="select" aria-label={_('Select tile')}>
                    <Tooltip
                        title={_(
                            'Select a tile to edit its label and description'
                        )}
                    >
                        <AdsClickIcon fontSize="small" />
                    </Tooltip>
                </ToggleButton>
            </ToggleButtonGroup>
            {mapStore.tool === 'paint' && (
                <SBrush>
                    <SmallText>{_('Brush')}</SmallText>
                    <Slider
                        size="small"
                        min={1}
                        max={MAX_BRUSH_SIZE}
                        step={1}
                        value={mapStore.brushSize}
                        onChange={(_e, v) =>
                            mapStore.setBrushSize(Array.isArray(v) ? v[0] : v)
                        }
                        valueLabelDisplay="auto"
                        aria-label={_('Brush size')}
                    />
                </SBrush>
            )}
            <Tooltip title={_('Minimap')}>
                <IconButton
                    size="small"
                    color={mapStore.showMinimap ? 'secondary' : 'inherit'}
                    onClick={() => mapStore.toggleShowMinimap()}
                    aria-label={_('Minimap')}
                >
                    <MapIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <SInfo>
                {hover && (
                    <>
                        <span>i: {hover.i}</span>
                        <span>j: {hover.j}</span>
                        <span>{color?.name ?? tile?.tile ?? '-'}</span>
                        {tile?.label && <span>“{tile.label}”</span>}
                    </>
                )}
            </SInfo>
        </>
    );
});

const SBrush = styled(Row)`
    width: 180px;
    gap: ${spacingCss(1.5)};
    align-items: center;
`;

const SInfo = styled(Row)`
    gap: ${spacingCss(1.5)};
    align-items: center;
    font-size: 13px;
    opacity: 0.8;
`;
