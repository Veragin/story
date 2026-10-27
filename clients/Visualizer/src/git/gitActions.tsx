import type { TGitBranchDto } from '@story/protocol';
import { showToast } from '@story/ui';
import { modals } from '../shell';
import { GitCommitDialog } from './GitCommitDialog';
import {
    GitDeleteBranchDialog,
    type TDeleteBranchAnswer,
} from './GitDeleteBranchDialog';
import {
    GitDirtySwitchDialog,
    type TDirtySwitchChoice,
} from './GitDirtySwitchDialog';
import type { GitStore } from './GitStore';

export const commitChanges = (store: GitStore): Promise<boolean> =>
    modals.ask<boolean>(
        (answer) => (
            <GitCommitDialog
                store={store}
                onClose={() => answer(false)}
                onCommitted={() => answer(true)}
            />
        ),
        false
    );

export const forcePush = async (store: GitStore): Promise<void> => {
    const confirmed = await modals.confirm({
        title: _('Force push?'),
        message: _(
            'This overwrites origin/%s with your local branch. Commits that only the remote has are lost.',
            store.status?.branch ?? ''
        ),
        danger: true,
        confirmLabel: _('Force push'),
    });
    if (!confirmed) return;
    const result = await store.forcePush();
    if (result.ok) showToast(_('Force pushed'), { variant: 'success' });
};

export const discardChanges = async (store: GitStore): Promise<void> => {
    const confirmed = await modals.confirm({
        title: _('Discard changes?'),
        message: _(
            'This drops all %d uncommitted changes. It cannot be undone.',
            store.changeCount
        ),
        danger: true,
        confirmLabel: _('Discard'),
    });
    if (!confirmed) return;
    const result = await store.discard();
    if (result.ok) showToast(_('Changes discarded'), { variant: 'success' });
};

export const askDeleteBranch = (
    branch: TGitBranchDto
): Promise<TDeleteBranchAnswer | null> =>
    modals.ask<TDeleteBranchAnswer | null>(
        (answer) => <GitDeleteBranchDialog branch={branch} onAnswer={answer} />,
        null
    );

const askDirtySwitch = (
    store: GitStore,
    branch: string
): Promise<TDirtySwitchChoice | null> =>
    modals.ask<TDirtySwitchChoice | null>(
        (answer) => (
            <GitDirtySwitchDialog
                branch={branch}
                changeCount={store.changeCount}
                onAnswer={answer}
            />
        ),
        null
    );

export const cleanBeforeSwitch = async (
    store: GitStore,
    branch: string
): Promise<boolean> => {
    if (!store.dirty) return true;
    const choice = await askDirtySwitch(store, branch);
    if (choice === 'discard') return (await store.discard()).ok;
    if (choice === 'commit') return commitChanges(store);
    return false;
};
