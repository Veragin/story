import { observer } from 'mobx-react-lite';
import { PasswordDialog } from '@story/ui';
import { auth } from '../api';

export const LoginPrompt = observer(() => (
    <PasswordDialog
        open={auth.prompt !== null}
        storyName={auth.prompt?.storyName ?? ''}
        message={_('This story is locked. Enter its password to edit it.')}
        onSubmit={auth.submit}
        onCancel={auth.cancel}
    />
));
