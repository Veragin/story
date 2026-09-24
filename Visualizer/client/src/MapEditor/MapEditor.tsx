import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    TextField,
    Typography,
} from '@mui/material';
import type { Scene } from '@story/canvas';
import { CanvasHost } from '@story/canvas/react';
import { Row } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useCallback, useState } from 'react';
import { LocationPanel } from './components/LocationPanel';
import type { MapStore } from './MapStore';

/**
 * The map canvas and its chrome (VISUALIZER_PLAN §7, Phase 6).
 *
 * The component's whole job is lifecycle: hand the mounted `Scene` to the store and get out of
 * the way. Nothing about the map re-renders React — the store's observable surface is the
 * toolbar's state, not the scene's (see `MapStore`).
 *
 * The note dialog lives here rather than on the canvas, for the reason `NoteTool` documents:
 * typing is the host's job, and a canvas-native text editor would mean re-implementing carets,
 * selection, IME and the clipboard.
 */
export const MapEditor = observer(({ store }: { store: MapStore }) => {
    const [noteText, setNoteText] = useState('');

    const onReady = useCallback(
        (scene: Scene) => store.attach(scene),
        // The store is created once per map by `MapWrapper`, so this is stable for the
        // component's lifetime — which is what `CanvasHost` requires of `onReady`.
        [store]
    );

    const request = store.noteRequest;

    const commit = (text: string) => {
        request?.commit(text);
        store.setNoteRequest(null);
    };

    return (
        <>
            <Row sx={{ flex: 1, minHeight: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <CanvasHost onReady={onReady} />
                </Box>
                <LocationPanel store={store} />
            </Row>

            <Dialog
                open={request !== null}
                onClose={() => commit(noteText)}
                fullWidth
                maxWidth="xs"
                // Seeded when the dialog opens rather than on every render, so typing is not
                // fighting the store.
                TransitionProps={{
                    onEnter: () =>
                        setNoteText(
                            request?.isNew ? '' : (request?.note.text ?? '')
                        ),
                }}
            >
                <DialogContent>
                    <Typography variant="caption" color="text.secondary">
                        {_(
                            'Name a river, a road, a region — anything the map should say out loud.'
                        )}
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        margin="dense"
                        label={_('Note')}
                        value={noteText}
                        onChange={(event) => setNoteText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                commit(noteText);
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            request?.cancel();
                            store.setNoteRequest(null);
                        }}
                    >
                        {_('Cancel')}
                    </Button>
                    {/* Not "Save": the toolbar already has one, and two buttons with the same
                        label in one view is ambiguous for a reader and for a click. */}
                    <Button
                        variant="contained"
                        onClick={() => commit(noteText)}
                    >
                        {request?.isNew ? _('Add note') : _('Update note')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
});
