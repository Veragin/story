import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import {
    apiEvents,
    displayText,
    type ApiEvents,
    type TVisualizerApi,
} from '../../../api';
import { StructureContext } from '../../../components/inputs/structureContext';
import type { EntityStore } from '../../../stores/EntityStore';
import type { StructureStore } from '../../../stores/StructureStore';
import { formatDiagnostic } from '../editor/diagnostics';
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
            <Dialog open onClose={close} maxWidth="md" fullWidth>
                <DialogTitle>{_('Chapter %s', title)}</DialogTitle>
                <DialogContent dividers>
                    {store.conflict &&
                        (store.conflict.current ? (
                            <Alert
                                severity="warning"
                                sx={{ mb: 2 }}
                                action={
                                    <>
                                        <Button
                                            color="inherit"
                                            size="small"
                                            onClick={() =>
                                                store.reloadFromDisk()
                                            }
                                        >
                                            {_('Reload')}
                                        </Button>
                                        <Button
                                            color="inherit"
                                            size="small"
                                            onClick={() =>
                                                void store.keepMine()
                                            }
                                        >
                                            {_('Keep mine')}
                                        </Button>
                                    </>
                                }
                            >
                                {_('Changed on disk.')}
                            </Alert>
                        ) : (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {_('This chapter was deleted on disk.')}
                            </Alert>
                        ))}
                    {store.error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {store.error}
                        </Alert>
                    )}
                    {store.unmappedDiagnostics.length > 0 && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {store.unmappedDiagnostics.map((d, i) => (
                                <div key={i}>{formatDiagnostic(d)}</div>
                            ))}
                        </Alert>
                    )}
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
                        !store.error && <CircularProgress size={24} />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={close}>
                        {store.dirty ? _('Discard') : _('Close')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={
                            !store.dirty ||
                            store.saving ||
                            store.conflict !== null
                        }
                        onClick={() => void save()}
                    >
                        {store.saving ? _('Saving…') : _('Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);
