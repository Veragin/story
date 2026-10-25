import {
    Alert,
    Divider,
    LinearProgress,
    ListItemText,
    Menu,
    MenuItem,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { showToast } from '@story/ui';
import type { GitStore } from './GitStore';
import {
    openGitBranchDialog,
    openGitCommitDialog,
    openGitHistoryDialog,
    openGitSettings,
} from './gitDialogs';

type TProps = {
    store: GitStore;
    anchorEl: HTMLElement;
    onClose: () => void;
};

export const GitMenu = observer(({ store, anchorEl, onClose }: TProps) => {
    const status = store.status;
    const dirtyHint = store.dirty ? _('Commit your changes first') : undefined;

    const openDialog = (open: () => void) => () => {
        onClose();
        open();
    };

    const push = async () => {
        const result = await store.push();
        if (result.ok) {
            showToast(_('Pushed'), { variant: 'success' });
            onClose();
        }
    };

    const pull = async () => {
        const result = await store.pull();
        if (!result.ok) return;
        showToast(
            result.value.updated
                ? _('Pulled the latest changes')
                : _('Already up to date'),
            { variant: 'success' }
        );
        onClose();
    };

    return (
        <Menu
            open
            anchorEl={anchorEl}
            onClose={onClose}
            slotProps={{ paper: { sx: { minWidth: 280, maxWidth: 420 } } }}
        >
            {store.busy && <LinearProgress />}
            <MenuItem
                disabled={store.busy || !store.dirty}
                onClick={openDialog(openGitCommitDialog)}
            >
                <ListItemText
                    primary={_('Commit & push…')}
                    secondary={
                        store.dirty
                            ? _('%d changes', store.changeCount)
                            : _('Nothing to commit')
                    }
                />
            </MenuItem>
            {store.canPush && (
                <MenuItem disabled={store.busy} onClick={() => void push()}>
                    <ListItemText
                        primary={_('Push')}
                        secondary={_('%d commits', status?.ahead ?? 0)}
                    />
                </MenuItem>
            )}
            <MenuItem
                disabled={store.busy || store.dirty}
                onClick={() => void pull()}
            >
                <ListItemText
                    primary={_('Pull')}
                    secondary={
                        dirtyHint ??
                        (status && status.behind > 0
                            ? _('%d new commits', status.behind)
                            : undefined)
                    }
                />
            </MenuItem>
            <MenuItem
                disabled={store.busy || store.dirty}
                onClick={openDialog(openGitBranchDialog)}
            >
                <ListItemText
                    primary={_('Switch branch…')}
                    secondary={dirtyHint}
                />
            </MenuItem>
            <MenuItem
                disabled={store.busy}
                onClick={openDialog(openGitHistoryDialog)}
            >
                <ListItemText primary={_('History…')} />
            </MenuItem>
            <Divider />
            <MenuItem
                disabled={store.busy}
                onClick={openDialog(openGitSettings)}
            >
                <ListItemText primary={_('Settings…')} />
            </MenuItem>
            {store.lastError && (
                <Alert
                    severity="error"
                    onClose={store.clearError}
                    sx={{ mx: 1, mt: 1, whiteSpace: 'pre-wrap' }}
                >
                    {store.lastError}
                </Alert>
            )}
        </Menu>
    );
});
