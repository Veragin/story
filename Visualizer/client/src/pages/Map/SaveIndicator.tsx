import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Button, CircularProgress, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Row, spacingCss } from '@story/ui';
import type { MapPageStore } from './MapPageStore';

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
