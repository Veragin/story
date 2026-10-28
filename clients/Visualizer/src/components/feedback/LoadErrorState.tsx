import { Alert, Button } from '@mui/material';

type TProps = {
    message: string;
    onRetry: () => void;
};

export const LoadErrorState = ({ message, onRetry }: TProps) => (
    <Alert
        severity="error"
        sx={{ whiteSpace: 'pre-wrap' }}
        action={
            <Button color="inherit" size="small" onClick={onRetry}>
                {_('Retry')}
            </Button>
        }
    >
        {message}
    </Alert>
);
