import { useEffect, useMemo, useRef, useState } from 'react';
import { reaction } from 'mobx';
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
import CodeMirror, {
    EditorView,
    type EditorState,
} from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import type { TDiagnosticDto, TSourceOwner } from '@story/visualizer-protocol';
import { apiEvents, type ApiEvents, type TVisualizerApi } from '../api';
import { modals } from '../shell';
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

// server positions are 1-based
const toCodeMirror = (
    state: EditorState,
    diagnostics: TDiagnosticDto[]
): Diagnostic[] =>
    diagnostics.map((d) => {
        const line = state.doc.line(
            Math.min(Math.max(1, d.line), state.doc.lines)
        );
        const from = Math.min(line.from + Math.max(0, d.column - 1), line.to);
        const word =
            /^[\w$]+/.exec(state.doc.sliceString(from, line.to))?.[0].length ??
            0;
        return {
            from,
            to: from + Math.max(word, from < line.to ? 1 : 0),
            severity: 'error',
            message: d.code ? `TS${d.code}: ${d.message}` : d.message,
        };
    });

export const SourceEditorDialog = observer(
    ({ owner, id, api, events = apiEvents, onClose }: TProps) => {
        const [store] = useState(
            () => new SourceEditorStore(owner, id, api, events)
        );
        const viewRef = useRef<EditorView | null>(null);

        useEffect(() => {
            void store.start();
            return () => store.destroy();
        }, [store]);

        const showDiagnostics = () => {
            const view = viewRef.current;
            if (!view) return;
            view.dispatch(
                setDiagnostics(
                    view.state,
                    toCodeMirror(view.state, store.fileDiagnostics)
                )
            );
        };
        useEffect(
            () => reaction(() => store.fileDiagnostics, showDiagnostics),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [store]
        );

        const extensions = useMemo(
            () => [
                javascript({ typescript: true }),
                lintGutter(),
                EditorView.lineWrapping,
            ],
            []
        );

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
                        <SEditor>
                            <CodeMirror
                                value={store.text}
                                onChange={(text) => store.setText(text)}
                                extensions={extensions}
                                theme="dark"
                                height="100%"
                                autoFocus
                                readOnly={store.saving}
                                onCreateEditor={(view) => {
                                    viewRef.current = view;
                                    showDiagnostics();
                                }}
                            />
                        </SEditor>
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

const SEditor = styled('div')`
    flex: 1;
    min-height: 0;
    overflow: hidden;
    font-size: 13px;

    & > div {
        height: 100%;
    }
`;
