import { Button, DialogContentText } from '@mui/material';
import { AppDialog } from '../components/dialog/AppDialog';
import { DialogButtons } from '../components/dialog/DialogButtons';

export type TDirtySwitchChoice = 'discard' | 'commit';

type TProps = {
    branch: string;
    changeCount: number;
    onClose: () => void;
    onChoose: (choice: TDirtySwitchChoice) => void;
};

export const GitDirtySwitchDialog = ({
    branch,
    changeCount,
    onClose,
    onChoose,
}: TProps) => (
    <AppDialog
        title={_('Uncommitted changes')}
        size="xs"
        onClose={onClose}
        actions={
            <>
                <Button color="error" onClick={() => onChoose('discard')}>
                    {_('Discard changes')}
                </Button>
                <DialogButtons
                    autoFocus
                    onClose={onClose}
                    onConfirm={() => onChoose('commit')}
                    label={_('Commit & push')}
                />
            </>
        }
    >
        <DialogContentText>
            {_(
                'There are %d uncommitted changes. Discard them, or commit and push them before switching to %s.',
                changeCount,
                branch
            )}
        </DialogContentText>
    </AppDialog>
);
