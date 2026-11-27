import { Button, styled, Tooltip } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { spacingCss } from '@story/ui';

export type TSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type TSaveLabels = {
    saving: string;
    saved: string;
    error: string;
};

type TProps = {
    status: TSaveStatus;
    error?: string | null;
    onRetry?: () => void;
    errorsOnly?: boolean;
    labels?: Partial<TSaveLabels>;
};

const labelFor = (status: TSaveStatus, labels: TSaveLabels) => {
    switch (status) {
        case 'pending':
        case 'saving':
            return labels.saving;
        case 'saved':
            return labels.saved;
        case 'error':
            return labels.error;
        case 'idle':
            return null;
    }
};

export const SaveStatus = ({
    status,
    error,
    onRetry,
    errorsOnly = false,
    labels,
}: TProps) => {
    const failed = status === 'error';
    const text = labelFor(status, {
        saving: _('Saving…'),
        saved: _('Saved'),
        error: _('Save failed'),
        ...labels,
    });
    if (!text || (errorsOnly && !failed)) return null;
    return (
        <Tooltip title={error ?? ''}>
            <SStatus data-status={status}>
                {failed && <ErrorOutlineIcon fontSize="small" />}
                {text}
                {failed && onRetry && (
                    <Button size="small" color="inherit" onClick={onRetry}>
                        {_('Retry')}
                    </Button>
                )}
            </SStatus>
        </Tooltip>
    );
};

const SStatus = styled('span')`
    display: inline-flex;
    align-items: center;
    gap: ${spacingCss(0.5)};
    margin-right: ${spacingCss(1)};
    font-size: ${({ theme }) => theme.typography.small.fontSize};
    white-space: nowrap;
    opacity: 0.7;
    &[data-status='error'] {
        color: ${({ theme }) => theme.palette.error.main};
        opacity: 1;
    }
`;
