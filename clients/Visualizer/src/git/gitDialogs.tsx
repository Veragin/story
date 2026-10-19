import { gitStore } from '../context';
import { modals } from '../shell';
import { GitBranchDialog } from './GitBranchDialog';
import { GitCommitDialog } from './GitCommitDialog';
import { GitHistoryDialog } from './GitHistoryDialog';
import { GitSettingsDialog } from './GitSettingsDialog';

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

export const openGitSettingsDialog = () =>
    modals.open((close) => (
        <GitSettingsDialog store={gitStore} onClose={close} />
    ));
