import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import type { TConfirmOptions } from './modals';

type TConfirmDialogProps = TConfirmOptions & {
    onAnswer: (answer: boolean) => void;
};

export const ConfirmDialog = ({
    title,
    message,
    danger,
    confirmLabel,
    cancelLabel,
    onAnswer,
}: TConfirmDialogProps) => (
    <Dialog open onClose={() => onAnswer(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        {message !== undefined && (
            <DialogContent>
                {typeof message === 'string' ? (
                    <DialogContentText>{message}</DialogContentText>
                ) : (
                    message
                )}
            </DialogContent>
        )}
        <DialogActions>
            <Button color="inherit" onClick={() => onAnswer(false)}>
                {cancelLabel ?? _('Cancel')}
            </Button>
            <Button
                variant="contained"
                color={danger ? 'error' : 'primary'}
                onClick={() => onAnswer(true)}
                autoFocus
            >
                {confirmLabel ?? (danger ? _('Delete') : _('OK'))}
            </Button>
        </DialogActions>
    </Dialog>
);
