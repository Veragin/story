import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import {
    Button,
    CircularProgress,
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
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Row, spacingCss } from '@story/ui';
import { ControlBar } from '../../shell';
import type { MapPageStore, TMapMode } from './MapPageStore';
import { openMapHelpModal } from './LocationModal';

/** The Map page's part of the top bar: mode switch, save status, fit and help. */
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
            sx={TOGGLE_SX}
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

/** Autosave state: unsaved / saving / saved / error (with retry). */
export const SaveIndicator = observer(({ store }: { store: MapPageStore }) => {
    switch (store.saveStatus) {
        case 'pending':
            return (
                <SStatus data-status="pending">{_('Unsaved changes')}</SStatus>
            );
        case 'saving':
            return (
                <SStatus data-status="saving">
                    <CircularProgress size={14} color="inherit" />
                    {_('Saving…')}
                </SStatus>
            );
        case 'saved':
            return (
                <SStatus data-status="saved">
                    <CheckIcon fontSize="small" color="success" />
                    {_('Saved')}
                </SStatus>
            );
        case 'error':
            return (
                <Tooltip title={store.saveError ?? ''}>
                    <SStatus data-status="error" style={{ color: '#f44336' }}>
                        <ErrorOutlineIcon fontSize="small" />
                        {_('Save failed')}
                        <Button
                            size="small"
                            color="inherit"
                            onClick={() => void store.retrySave()}
                        >
                            {_('Retry')}
                        </Button>
                    </SStatus>
                </Tooltip>
            );
        default:
            return store.loadState === 'ready' && store.version === '' ? (
                <SStatus data-status="new">
                    {_('New map (saved on the first edit)')}
                </SStatus>
            ) : null;
    }
});

const SStatus = styled(Row)`
    gap: ${spacingCss(0.5)};
    align-items: center;
    font-size: 13px;
    opacity: 0.85;
    white-space: nowrap;
`;

const SLabel = styled.span`
    margin-left: ${spacingCss(0.5)};
    text-transform: none;
`;

const TOGGLE_SX = {
    '& .MuiToggleButton-root': { color: '#bbb', borderColor: '#555' },
    '& .MuiToggleButton-root.Mui-selected': {
        color: '#fff',
        backgroundColor: '#ffffff26',
    },
};
