import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { AppDialog } from '../../../components/dialog/AppDialog';
import { DialogButtons } from '../../../components/dialog/DialogButtons';
import { ConflictAlert } from '../../../components/feedback/ConflictAlert';
import { DiagnosticsList } from '../../../components/feedback/DiagnosticsList';
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
import { ChapterInfoEditorStore } from './ChapterInfoEditorStore';
import { ChapterInfoForm } from './ChapterInfoForm';

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
        const [store] = useState(
            () => new ChapterInfoEditorStore(chapterId, api)
        );
        useEffect(() => {
            void store.load();
            return events.subscribe(
                { kind: 'chapter', id: chapterId },
                () => void store.onExternal()
            );
        }, [store, events, chapterId]);
        useEffect(() => {
            const releaseEntities = entities.start();
            const releaseStructure = structure.start();
            return () => {
                releaseStructure();
                releaseEntities();
            };
        }, [entities, structure]);

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
                {store.conflict && (
                    <ConflictAlert
                        deleted={!store.conflict.current}
                        what={_('chapter')}
                        onReload={
                            store.conflict.current
                                ? () => store.reloadFromDisk()
                                : undefined
                        }
                        onKeepMine={
                            store.conflict.current
                                ? () => store.keepMine()
                                : undefined
                        }
                    />
                )}
                <DiagnosticsList diagnostics={store.unmappedDiagnostics} />
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
