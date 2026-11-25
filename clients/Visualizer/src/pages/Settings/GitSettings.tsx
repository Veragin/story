import { observer } from 'mobx-react-lite';
import { HintText } from '../../components/feedback/HintText';
import { GitSettingsForm } from '../../git/GitSettingsForm';
import type { GitStore } from '../../git/GitStore';

type TProps = {
    git: GitStore;
};

export const GitSettings = observer(({ git }: TProps) =>
    git.available ? (
        <GitSettingsForm key={git.config?.version ?? 'none'} store={git} />
    ) : (
        <HintText>{_('Git is not available for this story.')}</HintText>
    )
);
