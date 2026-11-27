import { useEffect, useState } from 'react';
import {
    Button,
    Chip,
    LinearProgress,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    styled,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import { observer } from 'mobx-react-lite';
import { isGitBranchName, type TGitBranchDto } from '@story/protocol';
import { showToast } from '@story/ui';
import { DeleteButton } from '../components/buttons/DeleteButton';
import { AppDialog } from '../components/dialog/AppDialog';
import { DialogButtons } from '../components/dialog/DialogButtons';
import { ErrorAlert } from '../components/feedback/ErrorAlert';
import { FormField } from '../components/form/FormField';
import { FormTextInput } from '../components/form/FormTextInput';
import { TextInput } from '../components/inputs/TextInput';
import { InlineRow } from '../components/layout/InlineRow';
import { useVisualizerStore } from '../context';
import { askDeleteBranch, cleanBeforeSwitch } from './gitDialogs';
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
        let cancelled = false;
        const load = async () => {
            const result = await store.loadBranches();
            if (!cancelled) setLoadError(result.ok ? null : result.message);
        };
        void load();
        return () => {
            cancelled = true;
        };
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
                    <DeleteButton
                        iconOnly
                        label={_('Delete %s', branch.name)}
                        edge="end"
                        disabled={store.busy}
                        onClick={() => void remove(branch)}
                    />
                )
            }
        >
            <ListItemButton
                selected={branch.current}
                disabled={store.busy || branch.current}
                onClick={() => void switchTo(branch.name)}
            >
                <SCheck>
                    {branch.current && <CheckIcon fontSize="small" />}
                </SCheck>
                <ListItemText
                    primary={
                        <Stack direction="row" gap={1} alignItems="center">
                            <span>{branch.name}</span>
                            {!branch.local && (
                                <Chip size="small" label={_('Remote')} />
                            )}
                            {!branch.remote && (
                                <Chip size="small" label={_('Local')} />
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
        <AppDialog
            title={_('Branches')}
            titleActions={
                <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    disabled={store.busy || fetching}
                    onClick={() => void fetchBranches()}
                >
                    {_('Fetch')}
                </Button>
            }
            onClose={onClose}
            onSubmit={() => {
                if (name && !nameError) void create();
            }}
            actions={<DialogButtons closeOnly onClose={onClose} />}
        >
            {(store.busy || fetching) && <LinearProgress />}
            <FormTextInput
                label={_('Filter')}
                value={filter}
                onChange={(next) => setFilter(next ?? '')}
                dataField="filter"
            />
            <SBranches dense>{shown.map(renderBranch)}</SBranches>
            <FormField
                label={_('New branch from current')}
                error={nameError}
                helperText={
                    store.dirty
                        ? _('The uncommitted changes come along')
                        : undefined
                }
            >
                <InlineRow>
                    <TextInput
                        value={newBranch}
                        onChange={setNewBranch}
                        hasError={nameError !== null}
                        spellCheck={false}
                        ariaLabel={_('New branch from current')}
                        dataField="newBranch"
                    />
                    <Button
                        type="submit"
                        variant="outlined"
                        disabled={store.busy || !name || nameError !== null}
                    >
                        {_('Create')}
                    </Button>
                </InlineRow>
            </FormField>
            <ErrorAlert
                error={error}
                onClose={store.lastError ? clearError : undefined}
            />
        </AppDialog>
    );
});

const SCheck = styled(ListItemIcon)`
    min-width: 32px;
`;

const SBranches = styled(List)`
    max-height: 360px;
    overflow: auto;
`;
