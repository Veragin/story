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
    styled,
    Typography,
} from '@mui/material';
import type { TDiagnosticDto, TSourceOwner } from '@story/protocol';
import { apiEvents, type ApiEvents, type TVisualizerApi } from '../api';
import { modals } from '../shell';
import { CodeEditor } from './CodeEditor/CodeEditor';
import { SourceEditorStore } from './SourceEditorStore';

type TProps = {
    owner: TSourceOwner;
    id: string;
    api: TVisualizerApi;
    events?: ApiEvents;
    onClose: () => void;
};

const formatDiagnostic = (d: TDiagnosticDto) =>
    `${d.file}:${d.line}:${d.column} ${d.code ? `TS${d.code}: ` : ''}${d.message}`;

export const SourceEditorDialog = observer(
    ({ owner, id, api, events = apiEvents, onClose }: TProps) => {
        const [store] = useState(
            () => new SourceEditorStore(owner, id, api, events)
        );
        useEffect(() => {
            void store.start();
            return () => store.destroy();
        }, [store]);

        const close = async () => {
            if (
                store.dirty &&
                !(await modals.confirm({
                    title: _('Discard your changes?'),
                    message: _('The file has unsaved changes.'),
                    danger: true,
                    confirmLabel: _('Discard'),
                }))
            ) {
                return;
            }
            onClose();
        };

        return (
            <Dialog
                open
                onClose={() => void close()}
                maxWidth="lg"
                fullWidth
                onKeyDown={(e) => {
                    if (
                        (e.ctrlKey || e.metaKey) &&
                        e.key.toLowerCase() === 's'
                    ) {
                        e.preventDefault();
                        void store.save();
                    }
                }}
            >
                <DialogTitle sx={{ pb: 0 }}>
                    {owner === 'chapter'
                        ? _('Chapter %s', id)
                        : _('Passage %s', id)}
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        component="div"
                    >
                        {store.base?.file ?? ' '}
                    </Typography>
                </DialogTitle>
                <SContent dividers>
                    {store.conflict &&
                        (store.conflict.current ? (
                            <Alert
                                severity="warning"
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
                            <Alert severity="error">
                                {_('This file was deleted on disk.')}
                            </Alert>
                        ))}
                    {(store.error ?? store.loadError) && (
                        <Alert severity="error">
                            {store.error ?? store.loadError}
                        </Alert>
                    )}
                    {store.fileDiagnostics.length > 0 && (
                        <Alert severity="error">
                            {store.fileDiagnostics.length === 1
                                ? _(
                                      'Not saved: 1 type error, marked beside its line.'
                                  )
                                : _(
                                      'Not saved: %d type errors, marked beside their lines.',
                                      store.fileDiagnostics.length
                                  )}
                        </Alert>
                    )}
                    {store.otherDiagnostics.length > 0 && (
                        <Alert severity="error">
                            {_('Not saved: the change breaks other files.')}
                            {store.otherDiagnostics.map((d, i) => (
                                <div key={i}>{formatDiagnostic(d)}</div>
                            ))}
                        </Alert>
                    )}
                    {store.base ? (
                        <CodeEditor
                            value={store.text}
                            onChange={(text) => store.setText(text)}
                            diagnostics={store.fileDiagnostics}
                            height="100%"
                            autoFocus
                            readOnly={store.saving}
                        />
                    ) : (
                        !store.loadError && <CircularProgress size={24} />
                    )}
                </SContent>
                <DialogActions>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mr: 'auto', pl: 2 }}
                    >
                        {_(
                            'Saving formats the file and type-checks the story first.'
                        )}
                    </Typography>
                    <Button color="inherit" onClick={() => void close()}>
                        {store.dirty ? _('Discard') : _('Close')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={
                            !store.dirty ||
                            store.saving ||
                            store.conflict !== null
                        }
                        onClick={() => void store.save()}
                    >
                        {store.saving ? _('Saving…') : _('Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);

const SContent = styled(DialogContent)`
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 70vh;
`;
