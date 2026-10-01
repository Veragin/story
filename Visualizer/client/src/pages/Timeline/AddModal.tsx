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
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import { ApiError } from '../../api';
import { errorMessage, type TimelineStore } from './store/TimelineStore';

// ids end up in identifiers and passage ids (`<chapter>-<character>-<local>`)
const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

type TAddProps = {
    store: TimelineStore;
    time: number;
    close: () => void;
};

export const AddModal = observer(({ store, time, close }: TAddProps) => {
    const chapters = store.chapterIds;
    const locations = store.project?.locations ?? [];
    const selectedChapter =
        store.selected?.kind === 'chapter' ? store.selected.id : undefined;
    const [kind, setKind] = useState<'chapter' | 'trigger'>('chapter');
    const [id, setId] = useState('');
    const [chapterId, setChapterId] = useState(
        selectedChapter ?? chapters[0] ?? ''
    );
    const [location, setLocation] = useState(locations[0]?.id ?? '');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const idTaken =
        kind === 'chapter' ? store.chapters.has(id) : store.triggers.has(id);
    const idError =
        id === ''
            ? null
            : !ID_PATTERN.test(id)
              ? _('Letters and digits only, starting with a letter')
              : idTaken
                ? _('This id is taken')
                : null;
    const canSubmit =
        !busy &&
        id !== '' &&
        !idError &&
        (kind === 'chapter' ? location !== '' : chapterId !== '');

    const submit = async () => {
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            if (kind === 'chapter')
                await store.createChapter({
                    chapterId: id,
                    location,
                    start: time,
                });
            else await store.createTrigger({ chapterId, triggerId: id, time });
            close();
        } catch (e) {
            setError(
                e instanceof ApiError && e.code === 'exists'
                    ? _('This id is taken')
                    : errorMessage(e)
            );
            setBusy(false);
        }
    };

    return (
        <Dialog open onClose={close} maxWidth="xs" fullWidth>
            <DialogTitle>{_('Add to the timeline')}</DialogTitle>
            <DialogContent>
                <Stack gap={2} pt={1}>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={kind}
                        onChange={(_e, v) => v && setKind(v)}
                    >
                        <ToggleButton value="chapter">
                            {_('Chapter')}
                        </ToggleButton>
                        <ToggleButton value="trigger">
                            {_('Time trigger')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <TextField
                        autoFocus
                        size="small"
                        label={
                            kind === 'chapter'
                                ? _('Chapter id')
                                : _('Trigger id')
                        }
                        value={id}
                        onChange={(e) => setId(e.target.value.trim())}
                        onKeyDown={(e) => e.key === 'Enter' && void submit()}
                        error={!!idError}
                        helperText={idError ?? _('Cannot be changed later')}
                    />
                    {kind === 'chapter' ? (
                        <TextField
                            select
                            size="small"
                            label={_('Location')}
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        >
                            {locations.map((l) => (
                                <MenuItem key={l.id} value={l.id}>
                                    {l.name}
                                </MenuItem>
                            ))}
                        </TextField>
                    ) : (
                        <TextField
                            select
                            size="small"
                            label={_('Chapter')}
                            value={chapterId}
                            onChange={(e) => setChapterId(e.target.value)}
                        >
                            {chapters.map((c) => (
                                <MenuItem key={c} value={c}>
                                    {store.chapterTitle(c)}
                                </MenuItem>
                            ))}
                        </TextField>
                    )}
                    {error && (
                        <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                            {error}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={close}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    disabled={!canSubmit}
                    onClick={() => void submit()}
                >
                    {_('Add')}
                </Button>
            </DialogActions>
        </Dialog>
    );
});
