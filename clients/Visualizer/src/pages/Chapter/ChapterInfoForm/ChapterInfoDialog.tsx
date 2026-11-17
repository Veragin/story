import { observer } from 'mobx-react-lite';
import { AppDialog } from '../../../components/dialog/AppDialog';
import { DialogButtons } from '../../../components/dialog/DialogButtons';
import { LoadingState } from '../../../components/feedback/LoadingState';
import {
    apiEvents,
    displayText,
    type ApiEvents,
    type TVisualizerApi,
} from '../../../api';
import { StructureContext } from '../../../structure/structureContext';
import type { EntityStore } from '../../../stores/EntityStore';
import type { StructureStore } from '../../../stores/StructureStore';
import { ChapterInfoAlerts } from './ChapterInfoAlerts';
import { ChapterInfoForm } from './ChapterInfoForm';
import { useChapterInfoEditor } from './useChapterInfoEditor';
import { useStructureStores } from './useStructureStores';

type TProps = {
    chapterId: string;
    api: TVisualizerApi;
    structure: StructureStore;
    entities: EntityStore;
    events?: ApiEvents;
    onClose: () => void;
};

export const ChapterInfoDialog = observer(
    ({
        chapterId,
        api,
        structure,
        entities,
        events = apiEvents,
        onClose,
    }: TProps) => {
        const store = useChapterInfoEditor(chapterId, api, events);
        useStructureStores(entities, structure);

        const close = () => {
            store.discard();
            onClose();
        };
        const save = async () => {
            if (await store.save()) onClose();
        };
        const title = store.chapter
            ? displayText(store.chapter.title, chapterId)
            : chapterId;

        return (
            <AppDialog
                title={_('Chapter %s', title)}
                size="md"
                onClose={close}
                error={store.error}
                actions={
                    <DialogButtons
                        onClose={close}
                        cancelLabel={store.dirty ? _('Discard') : _('Close')}
                        onConfirm={() => void save()}
                        label={_('Save')}
                        busyLabel={_('Saving…')}
                        busy={store.saving}
                        disabled={!store.dirty || store.conflict !== null}
                    />
                }
            >
                <ChapterInfoAlerts store={store} />
                {store.draft && store.chapter ? (
                    <StructureContext.Provider value={structure}>
                        <ChapterInfoForm
                            chapterId={chapterId}
                            file={store.chapter.file}
                            value={store.draft}
                            onChange={(v) => store.setDraft(v)}
                            diagnostics={store.diagnosticsFor}
                            disabled={store.saving}
                        />
                    </StructureContext.Provider>
                ) : (
                    !store.error && <LoadingState />
                )}
            </AppDialog>
        );
    }
);
