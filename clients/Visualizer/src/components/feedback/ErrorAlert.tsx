import { Alert, styled } from '@mui/material';

type TProps = {
    error?: string | null;
    onClose?: () => void;
    className?: string;
};

export const ErrorAlert = ({ error, onClose, className }: TProps) =>
    error ? (
        <SAlert severity="error" onClose={onClose} className={className}>
            {error}
        </SAlert>
    ) : null;

const SAlert = styled(Alert)`
    white-space: pre-wrap;
`;
