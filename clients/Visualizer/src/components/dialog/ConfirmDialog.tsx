import type { ReactNode } from 'react';
import { DialogContentText } from '@mui/material';
import { AppDialog } from './AppDialog';
import { DialogButtons } from './DialogButtons';

type TProps = {
    title: string;
    message?: ReactNode;
    danger?: boolean;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onClose: () => void;
};

export const ConfirmDialog = ({
    title,
    message,
    danger,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onClose,
}: TProps) => (
    <AppDialog
        title={title}
        size="xs"
        onClose={onClose}
        actions={
            <DialogButtons
                onClose={onClose}
                onConfirm={onConfirm}
                label={confirmLabel ?? (danger ? _('Delete') : _('OK'))}
                cancelLabel={cancelLabel}
                danger={danger}
                autoFocus
            />
        }
    >
        {typeof message === 'string' ? (
            <DialogContentText>{message}</DialogContentText>
        ) : (
            message
        )}
    </AppDialog>
);
