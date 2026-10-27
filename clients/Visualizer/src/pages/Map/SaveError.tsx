import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Button, Tooltip } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Row, spacingCss } from '@story/ui';
import type { MapPageStore } from './MapPageStore';

export const SaveError = observer(({ store }: { store: MapPageStore }) =>
    store.saveStatus === 'error' ? (
        <Tooltip title={store.saveError ?? ''}>
            <SStatus data-status="error">
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
    ) : null
);

const SStatus = styled(Row)`
    gap: ${spacingCss(0.5)};
    align-items: center;
    font-size: 13px;
    white-space: nowrap;
    color: #f44336;
`;
