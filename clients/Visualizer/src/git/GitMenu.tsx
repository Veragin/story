import {
    Divider,
    LinearProgress,
    ListItemText,
    Menu,
    MenuItem,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { showToast } from '@story/ui';
import { ErrorAlert } from '../components/feedback/ErrorAlert';
import {
    discardChanges,
    forcePush,
    openGitBranchDialog,
    openGitCommitDialog,
    openGitSettings,
} from './gitDialogs';
import type { GitStore } from './GitStore';

type TProps = {
    store: GitStore;
    anchorEl: HTMLElement;
    onClose: () => void;
};

export const GitMenu = observer(({ store, anchorEl, onClose }: TProps) => {
    const status = store.status;
    const head = status?.head;

    const closeThen = (open: () => unknown) => () => {
        onClose();
        void open();
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
                disabled={store.busy}
                onClick={closeThen(openGitBranchDialog)}
            >
                <ListItemText
                    primary={status?.branch}
                    secondary={
                        head ? (
                            <>
                                <code>{head.shortHash}</code> {head.subject}
                            </>
                        ) : (
                            _('No commits yet')
                        )
                    }
                    slotProps={{
                        primary: { noWrap: true, fontWeight: 'bold' },
                        secondary: { noWrap: true },
                    }}
                />
            </MenuItem>
            <Divider />
            <MenuItem
                disabled={store.busy || !store.dirty}
                onClick={closeThen(openGitCommitDialog)}
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
                disabled={store.busy || status?.detached}
                onClick={closeThen(() => forcePush(store))}
            >
                <ListItemText primary={_('Force push…')} />
            </MenuItem>
            <MenuItem
                disabled={store.busy || store.dirty}
                onClick={() => void pull()}
            >
                <ListItemText
                    primary={_('Pull')}
                    secondary={
                        store.dirty
                            ? _('Commit your changes first')
                            : status && status.behind > 0
                              ? _('%d new commits', status.behind)
                              : undefined
                    }
                />
            </MenuItem>
            <MenuItem
                disabled={store.busy || !store.dirty}
                onClick={closeThen(() => discardChanges(store))}
            >
                <ListItemText primary={_('Discard changes…')} />
            </MenuItem>
            <Divider />
            <MenuItem
                disabled={store.busy}
                onClick={closeThen(openGitSettings)}
            >
                <ListItemText primary={_('Settings…')} />
            </MenuItem>
            <ErrorAlert
                error={store.lastError}
                onClose={store.clearError}
                sx={{ mx: 1, mt: 1 }}
            />
        </Menu>
    );
});
