import { observer } from 'mobx-react-lite';
import { PasswordDialog } from '@story/ui';
import { auth } from '../api';

/**
 * The password prompt for the edited story (`api/auth.ts`): shown when the server answers 401,
 * i.e. on the first visit or once the 24 h grant has expired. Cancel leaves for the landing page.
 */
export const LoginPrompt = observer(() => (
    <PasswordDialog
        open={auth.prompt !== null}
        storyName={auth.prompt?.storyName ?? ''}
        message={_('This story is locked. Enter its password to edit it.')}
        onSubmit={auth.submit}
        onCancel={auth.cancel}
    />
));
