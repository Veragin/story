import { Alert, Button, styled } from '@mui/material';

type TProps = {
    message: string;
    onRetry: () => void;
};

export const LoadErrorState = ({ message, onRetry }: TProps) => (
    <SAlert
        severity="error"
        action={
            <Button color="inherit" size="small" onClick={onRetry}>
                {_('Retry')}
            </Button>
        }
    >
        {message}
    </SAlert>
);

const SAlert = styled(Alert)`
    white-space: pre-wrap;
`;
