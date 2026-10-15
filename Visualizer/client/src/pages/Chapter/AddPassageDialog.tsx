import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
} from '@mui/material';
import type { TPassageType } from '@story/visualizer-protocol';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { errorText, idError } from './dialogUtils';

const PASSAGE_TYPES: { type: TPassageType; label: () => string }[] = [
    { type: 'screen', label: () => _('screen — text with links') },
    { type: 'linear', label: () => _('linear — description, then next') },
    { type: 'transition', label: () => _('transition — to another chapter') },
];

const isPassageType = (value: string): value is TPassageType =>
    PASSAGE_TYPES.some((t) => t.type === value);

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
                                onChange={(e) => setCharacterId(e.target.value)}
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
                                onChange={(e) => {
                                    const next = e.target.value;
                                    if (isPassageType(next)) setType(next);
                                }}
                            >
                                {PASSAGE_TYPES.map((t) => (
                                    <MenuItem key={t.type} value={t.type}>
                                        {t.label()}
                                    </MenuItem>
                                ))}
                            </TextField>
                            {error && <Alert severity="error">{error}</Alert>}
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
        );
    }
);
