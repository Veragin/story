import { CircularProgress, styled } from '@mui/material';
import type { TAiStatus } from '@story/protocol';
import { Column, Row, spacingCss } from '@story/ui';
import { AiTouchedFiles } from './AiTouchedFiles';

type TProps = {
    status: TAiStatus;
    message: string | null;
    touchedFiles: readonly string[];
};

const reasonOf = (status: TAiStatus): string => {
    switch (status) {
        case 'unavailable':
            return _('The agent is not available on this server.');
        case 'disabled':
            return _('The agent is not enabled for this story.');
        case 'no_credits':
            return _('The agent is out of credits.');
        case 'error':
            return _('The agent failed. Send a message to restart it.');
        default:
            return _('Agent is stopped. Send a message to start it.');
    }
};

export const AiActivity = ({ status, message, touchedFiles }: TProps) => {
    if (status === 'ready') {
        return (
            <SBar data-state="idle">
                <span>{_('Agent is idle')}</span>
            </SBar>
        );
    }
    if (status === 'busy' || status === 'starting') {
        return (
            <SBar data-state="working">
                <Row>
                    <SSpinner size={12} color="inherit" />
                    <span>{_('Agent is working')}</span>
                </Row>
                <SWarning>
                    {_("Don't edit the files it is changing until it finishes")}
                </SWarning>
                {touchedFiles.length > 0 && (
                    <AiTouchedFiles files={touchedFiles} />
                )}
            </SBar>
        );
    }
    return (
        <SBar data-state="stopped">
            <span>{message ?? reasonOf(status)}</span>
        </SBar>
    );
};

const SBar = styled(Column)`
    gap: ${spacingCss(0.5)};
    padding: ${spacingCss(1)} ${spacingCss(1.5)};
    border-top: 1px solid ${({ theme }) => theme.palette.border.subtle};
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;

const SSpinner = styled(CircularProgress)`
    margin-right: ${spacingCss(1)};
    align-self: center;
`;

const SWarning = styled('div')`
    color: ${({ theme }) => theme.palette.warning.main};
`;
