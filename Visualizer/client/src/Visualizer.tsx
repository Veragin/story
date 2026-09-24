import { Chapters } from './Chapters/Chapters';
import { ChapterPassages } from './Chapters/ChapterPassages';
import { useVisualizerStore } from './context';
import { observer } from 'mobx-react-lite';
import { EntitiesView } from './Entities/EntitiesView';
import { LocationView } from './Locations/LocationView';
import { MapWrapper } from './MapEditor/MapWrapper';
import { StructureView } from './Structure/StructureView';
import { TriggerView } from './Triggers/TriggerView';

export const Visualizer = observer(() => {
    const store = useVisualizerStore();

    /**
     * The default view is the chapter timeline, not the world-events playground.
     *
     * It used to be the playground, and that made the app a dead end on a fresh load: the
     * playground's only navigation is a "Back" button that sets the tab to `null`, i.e. back to
     * itself, and `NavPicker` — the one route to the map and the timeline — is rendered only
     * *inside* those two views. Nothing was reachable. VISUALIZER_PLAN §1.1 describes three
     * reachable tabs, so this restores what the plan assumed was already true; the playground
     * keeps its own nav entry below.
     */
    if (store.activeTab === null) {
        return <Chapters />;
    }

    if (store.activeTab.tab === 'chapters') {
        return <Chapters />;
    }

    if (store.activeTab.tab === 'chapter') {
        return <ChapterPassages chapterId={store.activeTab.chapterId} />;
    }

    if (store.activeTab.tab === 'map') {
        return <MapWrapper mapId={store.activeTab.mapId} />;
    }

    if (store.activeTab.tab === 'location') {
        return <LocationView locationId={store.activeTab.locationId} />;
    }

    if (store.activeTab.tab === 'trigger') {
        return (
            <TriggerView
                chapterId={store.activeTab.chapterId}
                triggerId={store.activeTab.triggerId}
            />
        );
    }

    if (store.activeTab.tab === 'entities') {
        return <EntitiesView />;
    }

    if (store.activeTab.tab === 'structure') {
        return <StructureView />;
    }

    return null;
});
