import { useState } from 'react';
import { DialogContentText } from '@mui/material';
import type { TGitBranchDto } from '@story/protocol';
import { AppDialog } from '../components/dialog/AppDialog';
import { DialogButtons } from '../components/dialog/DialogButtons';
import { FormCheckbox } from '../components/form/FormCheckbox';

export type TDeleteBranchAnswer = { remote: boolean };

type TProps = {
    branch: TGitBranchDto;
    onClose: () => void;
    onDelete: (answer: TDeleteBranchAnswer) => void;
};

export const GitDeleteBranchDialog = ({ branch, onClose, onDelete }: TProps) => {
    const [remote, setRemote] = useState(!branch.local);

    return (
        <AppDialog
            title={_('Delete branch %s?', branch.name)}
            size="xs"
            onClose={onClose}
            actions={
                <DialogButtons
                    danger
                    onClose={onClose}
                    onConfirm={() => onDelete({ remote })}
                    label={_('Delete')}
                />
            }
        >
            <DialogContentText>
                {branch.local
                    ? _('Commits that are on no other branch are lost.')
                    : _(
                          'The branch exists only on the remote: it is deleted there for everyone.'
                      )}
            </DialogContentText>
            {branch.local && branch.remote && (
                <FormCheckbox
                    label={_('Also delete origin/%s', branch.name)}
                    value={remote}
                    onChange={(next) => setRemote(next ?? false)}
                    dataField="remote"
                />
            )}
        </AppDialog>
    );
};
