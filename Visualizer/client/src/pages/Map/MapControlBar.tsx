import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
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
import { spacingCss } from '@story/ui';
import { ControlBar } from '../../shell';
import type { MapPageStore, TMapMode } from './MapPageStore';
import { openMapHelpModal } from './MapHelpModal';
import { SaveIndicator } from './SaveIndicator';

export const MapControlBar = observer(({ store }: { store: MapPageStore }) => (
    <ControlBar>
        <SaveIndicator store={store} />
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
                <SLabel>{_('View')}</SLabel>
            </ToggleButton>
            <ToggleButton value="locations" aria-label={_('Locations')}>
                <PlaceIcon fontSize="small" />
                <SLabel>{_('Locations')}</SLabel>
            </ToggleButton>
            <ToggleButton value="tiles" aria-label={_('Tiles')}>
                <BrushIcon fontSize="small" />
                <SLabel>{_('Tiles')}</SLabel>
            </ToggleButton>
        </ToggleButtonGroup>
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

const SLabel = styled.span`
    margin-left: ${spacingCss(0.5)};
    text-transform: none;
`;
