import { gitStore } from '../context';
import { modals, router } from '../shell';
import { GitBranchDialog } from './GitBranchDialog';
import { GitCommitDialog } from './GitCommitDialog';
import { GitHistoryDialog } from './GitHistoryDialog';

export const openGitCommitDialog = () =>
    modals.open((close) => (
        <GitCommitDialog store={gitStore} onClose={close} />
    ));

export const openGitBranchDialog = () =>
    modals.open((close) => (
        <GitBranchDialog store={gitStore} onClose={close} />
    ));

export const openGitHistoryDialog = () =>
    modals.open((close) => (
        <GitHistoryDialog store={gitStore} onClose={close} />
    ));

export const openGitSettings = () =>
    router.navigate({ page: 'settings', section: 'git' });
