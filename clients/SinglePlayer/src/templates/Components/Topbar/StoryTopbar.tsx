import { DefaultTopbar } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useEngine, useWorldState } from '../../../context';
import { TopbarErrorBoundary } from './TopbarErrorBoundary';
import { useStoryTopbar } from './useStoryTopbar';

const ObservedDefaultTopbar = observer(DefaultTopbar);

export const StoryTopbar = () => {
    const e = useEngine();
    const s = useWorldState();
    const Topbar = useStoryTopbar(e.storyModule.engine?.Topbar);
    const fallback = <ObservedDefaultTopbar s={s} />;

    if (Topbar === null) return fallback;
    return (
        <TopbarErrorBoundary fallback={fallback}>
            <Topbar s={s} e={e} />
        </TopbarErrorBoundary>
    );
};
