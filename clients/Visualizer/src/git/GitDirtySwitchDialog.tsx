import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';

export type TDirtySwitchChoice = 'discard' | 'commit';

type TProps = {
    branch: string;
    changeCount: number;
    onAnswer: (choice: TDirtySwitchChoice | null) => void;
};

export const GitDirtySwitchDialog = ({
    branch,
    changeCount,
    onAnswer,
}: TProps) => (
    <Dialog open onClose={() => onAnswer(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{_('Uncommitted changes')}</DialogTitle>
        <DialogContent>
            <DialogContentText>
                {_(
                    'There are %d uncommitted changes. Discard them, or commit and push them before switching to %s.',
                    changeCount,
                    branch
                )}
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button color="inherit" onClick={() => onAnswer(null)}>
                {_('Cancel')}
            </Button>
            <Button color="error" onClick={() => onAnswer('discard')}>
                {_('Discard changes')}
            </Button>
            <Button
                variant="contained"
                autoFocus
                onClick={() => onAnswer('commit')}
            >
                {_('Commit & push')}
            </Button>
        </DialogActions>
    </Dialog>
);
