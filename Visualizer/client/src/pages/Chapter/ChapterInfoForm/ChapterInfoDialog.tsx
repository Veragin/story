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
import { formatDiagnostic } from '../editor/diagnostics';
import { ChapterInfoEditorStore } from './ChapterInfoEditorStore';
import { ChapterInfoForm } from './ChapterInfoForm';

type TProps = {
    chapterId: string;
    api: TVisualizerApi;
    events?: ApiEvents;
    onClose: () => void;
};

/** The "edit chapter info" modal: `ChapterInfoForm` over `GET/PUT /chapters/:id`. */
export const ChapterInfoDialog = observer(
    ({ chapterId, api, events = apiEvents, onClose }: TProps) => {
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

        const close = () => {
            store.discard();
            onClose();
        };
        const project = store.project;
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
                    {store.draft ? (
                        <ChapterInfoForm
                            value={store.draft}
                            onChange={(v) => store.setDraft(v)}
                            locations={(project?.locations ?? []).map((l) => ({
                                id: l.id,
                                label: l.name,
                            }))}
                            chapters={(project?.chapters ?? [])
                                .filter((c) => c.id !== chapterId)
                                .map((c) => ({ id: c.id, label: c.name }))}
                            diagnostics={store.diagnosticsFor}
                            disabled={store.saving}
                        />
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
                        onClick={() =>
                            void store.save().then((ok) => ok && onClose())
                        }
                    >
                        {store.saving ? _('Saving…') : _('Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);
