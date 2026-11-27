import { Chip, styled, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { TAiStatus } from '@story/protocol';
import { Row, spacingCss } from '@story/ui';
import { TooltipIconButton } from '../components/buttons/TooltipIconButton';

type TStatusTone = 'success' | 'warning' | 'error' | 'muted';

const STATUS_TONES: Record<TAiStatus, TStatusTone> = {
    unavailable: 'muted',
    disabled: 'muted',
    stopped: 'muted',
    no_credits: 'error',
    error: 'error',
    starting: 'warning',
    busy: 'warning',
    ready: 'success',
};

const statusLabel = (status: TAiStatus): string => {
    switch (status) {
        case 'unavailable':
            return _('Unavailable');
        case 'disabled':
            return _('Disabled');
        case 'no_credits':
            return _('No credits');
        case 'stopped':
            return _('Stopped');
        case 'starting':
            return _('Starting');
        case 'ready':
            return _('Ready');
        case 'busy':
            return _('Working');
        case 'error':
            return _('Error');
    }
};

type TProps = {
    status: TAiStatus;
    credits: number;
    onClose: () => void;
};

export const AiSidebarHeader = ({ status, credits, onClose }: TProps) => (
    <SHeader>
        <Tooltip title={statusLabel(status)}>
            <SDot
                role="status"
                aria-label={statusLabel(status)}
                data-status={status}
                $tone={STATUS_TONES[status]}
            />
        </Tooltip>
        <STitle>{_('Ai agent')}</STitle>
        <Chip
            size="small"
            variant="outlined"
            color={credits > 0 ? 'default' : 'error'}
            label={_('%d credits', credits)}
        />
        <TooltipIconButton
            title={_('Close')}
            icon={CloseIcon}
            tone="inherit"
            onClick={onClose}
        />
    </SHeader>
);

const SHeader = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(1)} ${spacingCss(1)} ${spacingCss(1)} ${spacingCss(2)};
    border-bottom: 1px solid ${({ theme }) => theme.palette.border.subtle};
`;

const STitle = styled('div')`
    flex: 1;
    min-width: 0;
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const SDot = styled('span', {
    shouldForwardProp: (prop) => prop !== '$tone',
})<{ $tone: TStatusTone }>`
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: ${({ theme, $tone }) =>
        $tone === 'muted'
            ? theme.palette.text.disabled
            : theme.palette[$tone].main};
`;
