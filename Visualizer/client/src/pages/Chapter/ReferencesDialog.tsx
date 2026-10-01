import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import type { TReferenceDto } from '@story/visualizer-protocol';

export const ReferencesDialog = ({
    title,
    message,
    references,
    onClose,
}: {
    title: string;
    message: string;
    references: TReferenceDto[];
    onClose: () => void;
}) => (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
            <DialogContentText sx={{ mb: 1 }}>{message}</DialogContentText>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
                {references.map((r, i) => (
                    <li key={i}>
                        <code>
                            {r.file}:{r.line}
                        </code>
                        {r.passageId && <> — {r.passageId}</>}
                        {r.text && (
                            <div
                                style={{
                                    opacity: 0.7,
                                    fontFamily: 'monospace',
                                }}
                            >
                                {r.text}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>{_('OK')}</Button>
        </DialogActions>
    </Dialog>
);
