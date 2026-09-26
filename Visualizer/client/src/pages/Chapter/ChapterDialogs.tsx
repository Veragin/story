import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
    ThemeProvider,
} from '@mui/material';
import type { TPassageType, TReferenceDto } from '@story/visualizer-protocol';
import { darkTheme } from '../../theme';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { errorText, idError } from './dialogUtils';

/** The chapter view's dialogs; `dialogs.tsx` opens them. */

export const ReferencesDialog = ({
    title,
    message,
    references,
    onClose,
}: {
    title: string;
    message: string;
    references: TReferenceDto[];
    onClose: () => void;
}) => (
    <ThemeProvider theme={darkTheme}>
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 1 }}>{message}</DialogContentText>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {references.map((r, i) => (
                        <li key={i}>
                            <code>
                                {r.file}:{r.line}
                            </code>
                            {r.passageId && <> — {r.passageId}</>}
                            {r.text && (
                                <div
                                    style={{
                                        opacity: 0.7,
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {r.text}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{_('OK')}</Button>
            </DialogActions>
        </Dialog>
    </ThemeProvider>
);

export const AddCharacterDialog = observer(
    ({ store, onClose }: { store: ChapterGraphStore; onClose: () => void }) => {
        const options = store.availableCharacters;
        const [characterId, setCharacterId] = useState(options[0]?.id ?? '');
        const [startId, setStartId] = useState('intro');
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const startError = startId === '' ? null : idError(startId);

        const submit = async () => {
            setBusy(true);
            setError(null);
            try {
                await store.addCharacter(characterId, startId || undefined);
                onClose();
            } catch (e) {
                setError(errorText(e));
                setBusy(false);
            }
        };

        return (
            <ThemeProvider theme={darkTheme}>
                <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
                    <DialogTitle>
                        {_('Add character to %s', store.chapterTitle)}
                    </DialogTitle>
                    <DialogContent>
                        <Stack gap={2} sx={{ pt: 1 }}>
                            {options.length === 0 ? (
                                <Alert severity="info">
                                    {_(
                                        'Every character is already in this chapter.'
                                    )}
                                </Alert>
                            ) : (
                                <TextField
                                    select
                                    size="small"
                                    label={_('Character')}
                                    value={characterId}
                                    onChange={(e) =>
                                        setCharacterId(e.target.value)
                                    }
                                >
                                    {options.map((c) => (
                                        <MenuItem key={c.id} value={c.id}>
                                            {c.name} ({c.id})
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <TextField
                                size="small"
                                label={_('Start passage id')}
                                value={startId}
                                error={startError !== null}
                                helperText={
                                    startError ??
                                    _(
                                        'Local id of the start passage (default intro)'
                                    )
                                }
                                onChange={(e) =>
                                    setStartId(e.target.value.trim())
                                }
                            />
                            {error && <Alert severity="error">{error}</Alert>}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button color="inherit" onClick={onClose}>
                            {_('Cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            disabled={
                                busy || !characterId || startError !== null
                            }
                            onClick={() => void submit()}
                        >
                            {_('Add')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>
        );
    }
);

export const PickCharacterDialog = observer(
    ({
        store,
        onPick,
        onClose,
    }: {
        store: ChapterGraphStore;
        onPick: (id: string) => void;
        onClose: () => void;
    }) => {
        const options = store.chapterCharacters;
        const [characterId, setCharacterId] = useState(options[0]?.id ?? '');
        return (
            <ThemeProvider theme={darkTheme}>
                <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
                    <DialogTitle>
                        {_('Remove character from %s', store.chapterTitle)}
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            select
                            fullWidth
                            size="small"
                            label={_('Character')}
                            value={characterId}
                            sx={{ mt: 1 }}
                            onChange={(e) => setCharacterId(e.target.value)}
                        >
                            {options.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {_(
                                        '%s (%d passages)',
                                        c.name,
                                        c.passageCount
                                    )}
                                </MenuItem>
                            ))}
                        </TextField>
                    </DialogContent>
                    <DialogActions>
                        <Button color="inherit" onClick={onClose}>
                            {_('Cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            disabled={!characterId}
                            onClick={() => {
                                onClose();
                                onPick(characterId);
                            }}
                        >
                            {_('Remove…')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>
        );
    }
);

/** Confirm with the passage count, then remove; a 409 shows what still links to the passages. */

export const AddPassageDialog = observer(
    ({
        store,
        onClose,
        onAddCharacter,
    }: {
        store: ChapterGraphStore;
        onClose: () => void;
        onAddCharacter: () => void;
    }) => {
        const characters = store.chapterCharacters;
        const [characterId, setCharacterId] = useState(characters[0]?.id ?? '');
        const [localId, setLocalId] = useState('');
        const [type, setType] = useState<TPassageType>('screen');
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const localError = localId === '' ? null : idError(localId);
        const exists = store.passages.some(
            (p) =>
                p.passageId === `${store.chapterId}-${characterId}-${localId}`
        );

        const submit = async () => {
            setBusy(true);
            setError(null);
            try {
                const passage = await store.createPassage({
                    characterId,
                    localId,
                    type,
                });
                onClose();
                store.openEditor(passage.passageId);
            } catch (e) {
                setError(errorText(e));
                setBusy(false);
            }
        };

        return (
            <ThemeProvider theme={darkTheme}>
                <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
                    <DialogTitle>{_('Add passage')}</DialogTitle>
                    <DialogContent>
                        {characters.length === 0 ? (
                            <Alert
                                severity="info"
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={() => {
                                            onClose();
                                            onAddCharacter();
                                        }}
                                    >
                                        {_('Add character')}
                                    </Button>
                                }
                            >
                                {_(
                                    'This chapter has no characters yet. Use "Add character" first.'
                                )}
                            </Alert>
                        ) : (
                            <Stack gap={2} sx={{ pt: 1 }}>
                                <TextField
                                    select
                                    size="small"
                                    label={_('Character')}
                                    value={characterId}
                                    onChange={(e) =>
                                        setCharacterId(e.target.value)
                                    }
                                >
                                    {characters.map((c) => (
                                        <MenuItem key={c.id} value={c.id}>
                                            {c.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    size="small"
                                    label={_('Local id')}
                                    value={localId}
                                    autoFocus
                                    error={localError !== null || exists}
                                    helperText={
                                        localError ??
                                        (exists
                                            ? _('This passage already exists')
                                            : `${store.chapterId}-${characterId}-${localId || '…'}`)
                                    }
                                    onChange={(e) =>
                                        setLocalId(e.target.value.trim())
                                    }
                                />
                                <TextField
                                    select
                                    size="small"
                                    label={_('Type')}
                                    value={type}
                                    onChange={(e) =>
                                        setType(e.target.value as TPassageType)
                                    }
                                >
                                    <MenuItem value="screen">
                                        {_('screen — text with links')}
                                    </MenuItem>
                                    <MenuItem value="linear">
                                        {_('linear — description, then next')}
                                    </MenuItem>
                                    <MenuItem value="transition">
                                        {_('transition — to another chapter')}
                                    </MenuItem>
                                </TextField>
                                {error && (
                                    <Alert severity="error">{error}</Alert>
                                )}
                            </Stack>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button color="inherit" onClick={onClose}>
                            {_('Cancel')}
                        </Button>
                        <Button
                            variant="contained"
                            disabled={
                                busy ||
                                characters.length === 0 ||
                                !localId ||
                                localError !== null ||
                                exists
                            }
                            onClick={() => void submit()}
                        >
                            {_('Create')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>
        );
    }
);
