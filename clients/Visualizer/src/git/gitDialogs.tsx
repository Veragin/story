import { gitStore } from '../context';
import { modals, router } from '../shell';
import { commitChanges } from './gitActions';
import { GitBranchDialog } from './GitBranchDialog';

export const openGitCommitDialog = () => commitChanges(gitStore);

export const openGitBranchDialog = () =>
    modals.open((close) => (
        <GitBranchDialog store={gitStore} onClose={close} />
    ));

export const openGitSettings = () =>
    router.navigate({ page: 'settings', section: 'git' });
