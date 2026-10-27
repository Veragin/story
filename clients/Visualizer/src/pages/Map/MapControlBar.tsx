import { observer } from 'mobx-react-lite';
import {
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlaceIcon from '@mui/icons-material/Place';
import BrushIcon from '@mui/icons-material/Brush';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import MapIcon from '@mui/icons-material/Map';
import { ControlBar } from '../../shell';
import type { MapPageStore, TMapMode } from './MapPageStore';
import { openMapHelpModal } from './MapHelpModal';
import { SaveError } from './SaveError';

export const MapControlBar = observer(({ store }: { store: MapPageStore }) => (
    <ControlBar>
        <SaveError store={store} />
        <ToggleButtonGroup
            size="small"
            exclusive
            value={store.mode}
            onChange={(_e, mode: TMapMode | null) =>
                mode && store.setMode(mode)
            }
            aria-label={_('Map mode')}
        >
            <ToggleButton value="view" aria-label={_('View')}>
                <VisibilityIcon fontSize="small" />
                {_('View')}
            </ToggleButton>
            <ToggleButton value="locations" aria-label={_('Locations')}>
                <PlaceIcon fontSize="small" />
                {_('Locations')}
            </ToggleButton>
            <ToggleButton value="tiles" aria-label={_('Tiles')}>
                <BrushIcon fontSize="small" />
                {_('Tiles')}
            </ToggleButton>
        </ToggleButtonGroup>
        {store.mode === 'tiles' && (
            <Tooltip title={_('Minimap')}>
                <IconButton
                    color={store.tiles.showMinimap ? 'secondary' : 'inherit'}
                    onClick={() => store.tiles.toggleShowMinimap()}
                    aria-label={_('Minimap')}
                    aria-pressed={store.tiles.showMinimap}
                >
                    <MapIcon />
                </IconButton>
            </Tooltip>
        )}
        <Tooltip title={_('Show the whole map')}>
            <IconButton
                color="inherit"
                onClick={store.fitMap}
                aria-label={_('Show the whole map')}
            >
                <CenterFocusStrongIcon />
            </IconButton>
        </Tooltip>
        <Tooltip title={_('Help')}>
            <IconButton
                color="inherit"
                onClick={() => openMapHelpModal()}
                aria-label={_('Help')}
            >
                <HelpOutlineIcon />
            </IconButton>
        </Tooltip>
    </ControlBar>
));
