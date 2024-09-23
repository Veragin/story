import { useStore } from 'code/Context';
import { observer } from 'mobx-react-lite';
import { ScreenTemplate } from './templates/ScreenTemplate';
import { CharacterPicker } from './CharacterPicker';

export const Engine = observer(() => {
    const store = useStore();
    const passage = store.passage;

    if (passage === null) {
        return <CharacterPicker />;
    }

    return <ScreenTemplate passage={passage} />;
});
