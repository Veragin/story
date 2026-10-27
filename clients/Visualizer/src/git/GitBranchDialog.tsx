import { useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    TextField,
    Tooltip,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { observer } from 'mobx-react-lite';
import { isGitBranchName, type TGitBranchDto } from '@story/protocol';
import { showToast } from '@story/ui';
import { useVisualizerStore } from '../context';
import { askDeleteBranch, cleanBeforeSwitch } from './gitActions';
import type { GitStore } from './GitStore';
import { relativeAge } from './relativeAge';

type TProps = {
    store: GitStore;
    onClose: () => void;
};

export const GitBranchDialog = observer(({ store, onClose }: TProps) => {
    const { timeManager } = useVisualizerStore();
    const [filter, setFilter] = useState('');
    const [newBranch, setNewBranch] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [fetching, setFetching] = useState(false);

    const { refsKey, clearError } = store;
    useEffect(() => {
        const load = async () => {
            const result = await store.loadBranches();
            setLoadError(result.ok ? null : result.message);
        };
        void load();
    }, [store, refsKey]);
    useEffect(clearError, [clearError]);

    const branches = store.branches ?? [];
    const needle = filter.trim().toLowerCase();
    const shown = branches.filter((b) => b.name.toLowerCase().includes(needle));

    const name = newBranch.trim();
    const nameError =
        name === ''
            ? null
            : !isGitBranchName(name)
              ? _('Not a valid branch name')
              : branches.some((b) => b.name === name)
                ? _('That branch exists')
                : null;

    const fetchBranches = async () => {
        setFetching(true);
        await store.fetch({ force: true });
        setFetching(false);
    };

    const switchTo = async (branch: string) => {
        if (!(await cleanBeforeSwitch(store, branch))) return;
        const result = await store.checkout(branch, false);
        if (result.ok)
            showToast(_('Switched to %s', branch), { variant: 'success' });
    };

    const create = async () => {
        const result = await store.checkout(name, true);
        if (!result.ok) return;
        setNewBranch('');
        showToast(_('Created and switched to %s', name), {
            variant: 'success',
        });
    };

    const remove = async (branch: TGitBranchDto) => {
        const answer = await askDeleteBranch(branch);
        if (!answer) return;
        const result = await store.deleteBranch(branch.name, answer.remote);
        if (result.ok)
            showToast(_('Deleted %s', branch.name), { variant: 'success' });
    };

    const renderBranch = (branch: TGitBranchDto) => (
        <ListItem
            key={branch.name}
            disablePadding
            secondaryAction={
                !branch.current && (
                    <Tooltip title={_('Delete branch')}>
                        <span>
                            <IconButton
                                edge="end"
                                size="small"
                                aria-label={_('Delete %s', branch.name)}
                                disabled={store.busy}
                                onClick={() => void remove(branch)}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )
            }
        >
            <ListItemButton
                selected={branch.current}
                disabled={store.busy || branch.current}
                onClick={() => void switchTo(branch.name)}
            >
                <ListItemIcon sx={{ minWidth: 32 }}>
                    {branch.current && <CheckIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText
                    primary={
                        <Stack direction="row" gap={1} alignItems="center">
                            <span>{branch.name}</span>
                            {!branch.local && (
                                <Chip size="small" label={_('remote')} />
                            )}
                            {!branch.remote && (
                                <Chip size="small" label={_('local')} />
                            )}
                        </Stack>
                    }
                    secondary={
                        <span
                            title={new Date(
                                branch.commit.date
                            ).toLocaleString()}
                        >
                            <code>{branch.commit.shortHash}</code> ·{' '}
                            {branch.commit.subject} · {branch.commit.author} ·{' '}
                            {relativeAge(timeManager, branch.commit.date)}
                        </span>
                    }
                    slotProps={{ secondary: { noWrap: true } }}
                />
            </ListItemButton>
        </ListItem>
    );

    const error = store.lastError ?? loadError;

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Stack direction="row" alignItems="center" gap={1}>
                    <Box component="span" sx={{ flex: 1 }}>
                        {_('Branches')}
                    </Box>
                    <Button
                        size="small"
                        startIcon={<RefreshIcon />}
                        disabled={store.busy || fetching}
                        onClick={() => void fetchBranches()}
                    >
                        {_('Fetch')}
                    </Button>
                </Stack>
            </DialogTitle>
            {(store.busy || fetching) && <LinearProgress />}
            <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                    <TextField
                        size="small"
                        label={_('Filter')}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        slotProps={{ htmlInput: { 'aria-label': 'filter' } }}
                    />
                    <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
                        {shown.map(renderBranch)}
                    </List>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (name && !nameError) void create();
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
                                helperText={
                                    nameError ??
                                    (store.dirty
                                        ? _(
                                              'The uncommitted changes come along'
                                          )
                                        : ' ')
                                }
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
                                    store.busy || !name || nameError !== null
                                }
                            >
                                {_('Create')}
                            </Button>
                        </Stack>
                    </form>
                    {error && (
                        <Alert
                            severity="error"
                            onClose={store.lastError ? clearError : undefined}
                            sx={{ whiteSpace: 'pre-wrap' }}
                        >
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
