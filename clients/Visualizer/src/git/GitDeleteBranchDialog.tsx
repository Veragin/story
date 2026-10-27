import { useState } from 'react';
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
} from '@mui/material';
import type { TGitBranchDto } from '@story/protocol';

export type TDeleteBranchAnswer = { remote: boolean };

type TProps = {
    branch: TGitBranchDto;
    onAnswer: (answer: TDeleteBranchAnswer | null) => void;
};

export const GitDeleteBranchDialog = ({ branch, onAnswer }: TProps) => {
    const [remote, setRemote] = useState(!branch.local);

    return (
        <Dialog open onClose={() => onAnswer(null)} maxWidth="xs" fullWidth>
            <DialogTitle>{_('Delete branch %s?', branch.name)}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {branch.local
                        ? _('Commits that are on no other branch are lost.')
                        : _(
                              'The branch exists only on the remote: it is deleted there for everyone.'
                          )}
                </DialogContentText>
                {branch.local && branch.remote && (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={remote}
                                onChange={(e) => setRemote(e.target.checked)}
                                slotProps={{
                                    input: { 'aria-label': 'remote' },
                                }}
                            />
                        }
                        label={_('Also delete origin/%s', branch.name)}
                    />
                )}
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={() => onAnswer(null)}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    color="error"
                    autoFocus
                    onClick={() => onAnswer({ remote })}
                >
                    {_('Delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
