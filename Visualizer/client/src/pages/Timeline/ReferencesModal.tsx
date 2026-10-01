import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import type { TReferenceDto } from '@story/visualizer-protocol';

export const ReferencesModal = ({
    title,
    references,
    close,
}: {
    title: string;
    references: TReferenceDto[];
    close: () => void;
}) => (
    <Dialog open onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
            <Alert severity="info" sx={{ mb: 1 }}>
                {_('Nothing was deleted. Remove these references first:')}
            </Alert>
            <List dense>
                {references.map((r, i) => (
                    <ListItem key={i} disableGutters>
                        <ListItemText
                            primary={`${r.file}:${r.line}${r.passageId ? ` (${r.passageId})` : ''}`}
                            secondary={r.text}
                            primaryTypographyProps={{
                                fontFamily: 'monospace',
                                fontSize: 13,
                            }}
                        />
                    </ListItem>
                ))}
            </List>
        </DialogContent>
        <DialogActions>
            <Button onClick={close}>{_('Close')}</Button>
        </DialogActions>
    </Dialog>
);
