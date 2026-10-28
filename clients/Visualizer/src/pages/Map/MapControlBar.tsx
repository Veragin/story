import { observer } from 'mobx-react-lite';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PlaceIcon from '@mui/icons-material/Place';
import BrushIcon from '@mui/icons-material/Brush';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import MapIcon from '@mui/icons-material/Map';
import { ControlBar } from '../../shell';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { HelpButton } from '../../components/buttons/HelpButton';
import type { MapPageStore, TMapMode } from './MapPageStore';
import { openMapHelp } from './mapDialogs';
import { SaveStatus } from '../../components/feedback/SaveStatus';

export const MapControlBar = observer(({ store }: { store: MapPageStore }) => (
    <ControlBar>
        <SaveStatus
            status={store.saveStatus}
            error={store.saveError}
            onRetry={() => void store.retrySave()}
            errorsOnly
        />
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
        <TooltipIconButton
            title={_('Minimap')}
            icon={MapIcon}
            tone="inherit"
            pressed={store.tiles.showMinimap}
            onClick={() => store.tiles.toggleShowMinimap()}
        />
        <TooltipIconButton
            title={_('Show the whole map')}
            icon={CenterFocusStrongIcon}
            tone="inherit"
            onClick={store.fitMap}
        />
        <HelpButton onClick={() => openMapHelp()} />
    </ControlBar>
));
