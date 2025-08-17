import { Chapters } from './Chapters/Chapters';
import { ChapterPassages } from './Chapters/ChapterPassages';
import { useVisualizerStore } from 'code/Context';
import { observer } from 'mobx-react-lite';
import { MapWrapper } from './MapEditor/MapWrapper';

export const Visualizer = observer(() => {
    const store = useVisualizerStore();

    if (store.activeTab === null) {
        return <Chapters />;
    }

    if (store.activeTab.tab === 'chapter') {
        return <ChapterPassages chapterId={store.activeTab.chapterId} />;
    }

    if (store.activeTab.tab === 'map') {
        return <MapWrapper mapId={store.activeTab.mapId} />;
    }

    return null;
});