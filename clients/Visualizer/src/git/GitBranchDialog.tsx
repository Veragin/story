import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Stack,
    TextField,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { observer } from 'mobx-react-lite';
import { isGitBranchName } from '@story/protocol';
import { showToast } from '@story/ui';
import type { GitStore } from './GitStore';

type TProps = {
    store: GitStore;
    onClose: () => void;
};

export const GitBranchDialog = observer(({ store, onClose }: TProps) => {
    const [filter, setFilter] = useState('');
    const [newBranch, setNewBranch] = useState('');
    const [error, setError] = useState<string | null>(null);

    const status = store.status;
    const current = status?.branch ?? '';
    const local = status?.localBranches ?? [];
    const remoteOnly = (status?.remoteBranches ?? []).filter(
        (b) => !local.includes(b)
    );
    const needle = filter.trim().toLowerCase();
    const matches = (branch: string) => branch.toLowerCase().includes(needle);

    const name = newBranch.trim();
    const nameError =
        name === ''
            ? null
            : !isGitBranchName(name)
              ? _('Not a valid branch name')
              : local.includes(name) || remoteOnly.includes(name)
                ? _('That branch exists')
                : null;

    const checkout = async (branch: string, create: boolean) => {
        setError(null);
        const result = await store.checkout(branch, create);
        if (!result.ok) {
            setError(result.message);
            return;
        }
        showToast(_('Switched to %s', branch), { variant: 'success' });
        onClose();
    };

    const renderBranch = (branch: string, remote: boolean) => (
        <ListItemButton
            key={`${remote ? 'remote' : 'local'}/${branch}`}
            selected={branch === current}
            disabled={store.busy || store.dirty || branch === current}
            onClick={() => void checkout(branch, false)}
        >
            <ListItemIcon>
                {branch === current && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText
                primary={remote ? `origin/${branch}` : branch}
                secondary={branch === current ? _('current') : undefined}
            />
        </ListItemButton>
    );

    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{_('Switch branch')}</DialogTitle>
            <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                    {store.dirty && (
                        <Alert severity="warning">
                            {_(
                                'There are uncommitted changes. Commit them before switching.'
                            )}
                        </Alert>
                    )}
                    <TextField
                        size="small"
                        label={_('Filter')}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        slotProps={{ htmlInput: { 'aria-label': 'filter' } }}
                    />
                    <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
                        <ListSubheader>{_('Local')}</ListSubheader>
                        {local
                            .filter(matches)
                            .map((b) => renderBranch(b, false))}
                        {remoteOnly.length > 0 && (
                            <ListSubheader>{_('Remote')}</ListSubheader>
                        )}
                        {remoteOnly
                            .filter(matches)
                            .map((b) => renderBranch(b, true))}
                    </List>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (name && !nameError) void checkout(name, true);
                        }}
                    >
                        <Stack direction="row" gap={1} alignItems="flex-start">
                            <TextField
                                size="small"
                                fullWidth
                                label={_('New branch from current')}
                                value={newBranch}
                                onChange={(e) => setNewBranch(e.target.value)}
                                error={nameError !== null}
                                helperText={nameError ?? ' '}
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'new branch',
                                        'spellCheck': false,
                                    },
                                }}
                            />
                            <Button
                                type="submit"
                                variant="outlined"
                                disabled={
                                    store.busy ||
                                    store.dirty ||
                                    !name ||
                                    nameError !== null
                                }
                            >
                                {_('Create')}
                            </Button>
                        </Stack>
                    </form>
                    {error && (
                        <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                            {error}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onClose}>
                    {_('Close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});
