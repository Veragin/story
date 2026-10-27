import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import BrushIcon from '@mui/icons-material/Brush';
import AdsClickIcon from '@mui/icons-material/AdsClick';
import { spacingCss } from '@story/ui';
import type { MapStore } from '../MapStore';
import type { TTileTool } from '../types';
import { ToolWindow } from './ToolWindow/ToolWindow';
import { Palette } from './Palette/Palette';
import { EditWidget } from './EditWidget';

export const TileTools = observer(({ mapStore }: { mapStore: MapStore }) => {
    const hover = mapStore.hoverTile;
    void mapStore.revision;
    const tile = hover ? mapStore.getTile(hover) : undefined;
    const color = tile ? mapStore.data?.palette[tile.tile] : undefined;

    return (
        <ToolWindow
            title={_('Tiles')}
            info={
                hover && (
                    <span data-testid="tile-hover-info">
                        {hover.i}, {hover.j} ·{' '}
                        {color?.name ?? tile?.tile ?? '-'}
                        {tile?.label && ` “${tile.label}”`}
                    </span>
                )
            }
            actions={
                <SToggleGroup
                    size="small"
                    exclusive
                    value={mapStore.tool}
                    onChange={(_e, tool: TTileTool | null) =>
                        tool && mapStore.setTool(tool)
                    }
                    aria-label={_('Tile tool')}
                >
                    <Tooltip title={_('Paint tiles')}>
                        <ToggleButton
                            value="paint"
                            aria-label={_('Paint tiles')}
                        >
                            <BrushIcon fontSize="small" />
                        </ToggleButton>
                    </Tooltip>
                    <Tooltip title={_('Select tile')}>
                        <ToggleButton
                            value="select"
                            aria-label={_('Select tile')}
                        >
                            <AdsClickIcon fontSize="small" />
                        </ToggleButton>
                    </Tooltip>
                </SToggleGroup>
            }
        >
            {mapStore.tool === 'paint' && <Palette mapStore={mapStore} />}
            {mapStore.tool === 'select' && <EditWidget mapStore={mapStore} />}
        </ToolWindow>
    );
});

const SToggleGroup = styled(ToggleButtonGroup)`
    flex-shrink: 0;
    & .MuiToggleButton-root {
        padding: ${spacingCss(0.375)};
    }
`;
