import type { TReferenceDto } from '@story/protocol';
import { DialogContentText } from '@mui/material';
import { ReferenceList } from '../feedback/ReferenceList';
import { AppDialog } from './AppDialog';
import { DialogButtons } from './DialogButtons';

type TProps = {
    title: string;
    message: string;
    references: TReferenceDto[];
    onClose: () => void;
};

export const ReferencesDialog = ({
    title,
    message,
    references,
    onClose,
}: TProps) => (
    <AppDialog
        title={title}
        size="sm"
        onClose={onClose}
        actions={<DialogButtons closeOnly onClose={onClose} />}
    >
        <DialogContentText>{message}</DialogContentText>
        <ReferenceList references={references} />
    </AppDialog>
);
