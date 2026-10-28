import type { ReactNode } from 'react';
import { DialogContentText } from '@mui/material';
import { AppDialog } from './AppDialog';
import { DialogButtons } from './DialogButtons';

type TProps = {
    title?: string;
    message: ReactNode;
    onClose: () => void;
};

export const AlertDialog = ({ title, message, onClose }: TProps) => (
    <AppDialog
        title={title}
        size="xs"
        onClose={onClose}
        actions={
            <DialogButtons closeOnly closeLabel={_('OK')} onClose={onClose} />
        }
    >
        {typeof message === 'string' ? (
            <DialogContentText sx={{ whiteSpace: 'pre-wrap' }}>
                {message}
            </DialogContentText>
        ) : (
            message
        )}
    </AppDialog>
);
