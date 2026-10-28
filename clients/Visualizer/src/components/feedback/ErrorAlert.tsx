import { Alert, type AlertProps } from '@mui/material';

type TProps = {
    error?: string | null;
    onClose?: () => void;
    sx?: AlertProps['sx'];
};

export const ErrorAlert = ({ error, onClose, sx }: TProps) =>
    error ? (
        <Alert
            severity="error"
            onClose={onClose}
            sx={[{ whiteSpace: 'pre-wrap' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
        >
            {error}
        </Alert>
    ) : null;
