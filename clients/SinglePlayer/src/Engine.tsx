import { observer } from 'mobx-react-lite';
import type { TPlayManifestDto } from '@story/protocol';
import { useStore } from './context';
import { Landing } from './landing/Landing';
import { LinearTemplate } from './templates/LinearTemplate';
import { ScreenTemplate } from './templates/ScreenTemplate';

type Props = {
    manifest: TPlayManifestDto;
};

export const Engine = observer(({ manifest }: Props) => {
    const store = useStore();
    const passage = store.passage;

    if (passage === null) {
        return <Landing manifest={manifest} />;
    }

    switch (passage.type) {
        case 'screen':
            return <ScreenTemplate passage={passage} />;
        case 'linear':
            return <LinearTemplate passage={passage} />;
    }
});
