import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    isCode,
    type TReferenceDto,
    type TTriggerDto,
} from '@story/visualizer-protocol';
import { ApiError } from '../../api';
import { errorMessage, type TimelineStore } from './store/TimelineStore';

/** Ids end up in identifiers and passage ids (`<chapter>-<character>-<local>`): no `-`, no spaces. */
const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

// ---- Add ----------------------------------------------------------------------------------------

type TAddProps = {
    store: TimelineStore;
    /** Time (seconds) where the new chapter / trigger goes: the middle of the view. */
    time: number;
    close: () => void;
};

/** "Add": a chapter or a trigger, by id (and, for a trigger, its chapter). */
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

// ---- Trigger ------------------------------------------------------------------------------------

const asText = (value: TTriggerDto['name']) =>
    isCode(value) ? value.code : value;

type TTriggerProps = {
    store: TimelineStore;
    triggerId: string;
    close: () => void;
};

/**
 * Time trigger modal: name and description. On `409 stale` (or when the trigger changes on disk
 * while there is unsaved input) it offers "Reload" (take the file's values) or "Keep mine"
 * (save again on top of the new version).
 */
export const TriggerModal = observer(
    ({ store, triggerId, close }: TTriggerProps) => {
        const dto = store.triggers.get(triggerId);
        const [base, setBase] = useState(dto);
        const [name, setName] = useState(dto ? asText(dto.name) : '');
        const [description, setDescription] = useState(
            dto ? asText(dto.description) : ''
        );
        const [error, setError] = useState<string | null>(null);
        const [busy, setBusy] = useState(false);

        if (!dto || !base) {
            return (
                <Dialog open onClose={close} maxWidth="xs" fullWidth>
                    <DialogTitle>{_('Time trigger')}</DialogTitle>
                    <DialogContent>
                        <Alert severity="warning">
                            {_('Trigger %s no longer exists.', triggerId)}
                        </Alert>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={close}>{_('Close')}</Button>
                    </DialogActions>
                </Dialog>
            );
        }

        const nameIsCode = isCode(base.name);
        const descriptionIsCode = isCode(base.description);
        const dirty =
            name !== asText(base.name) ||
            description !== asText(base.description);
        const changedOnDisk = dto.version !== base.version;

        const reload = () => {
            setBase(dto);
            setName(asText(dto.name));
            setDescription(asText(dto.description));
            setError(null);
        };

        const save = async (version: string) => {
            setBusy(true);
            setError(null);
            try {
                await store.updateTrigger(triggerId, {
                    version,
                    ...(nameIsCode ? {} : { name }),
                    ...(descriptionIsCode ? {} : { description }),
                });
                close();
            } catch (e) {
                if (e instanceof ApiError && e.isStale) {
                    void store.refetchTrigger(triggerId);
                    setError(_('The trigger changed on disk.'));
                } else {
                    setError(errorMessage(e));
                }
                setBusy(false);
            }
        };

        return (
            <Dialog open onClose={close} maxWidth="sm" fullWidth>
                <DialogTitle>{_('Time trigger %s', triggerId)}</DialogTitle>
                <DialogContent>
                    <Stack gap={2} pt={1}>
                        <TextField
                            size="small"
                            label={_('Name')}
                            value={name}
                            disabled={nameIsCode}
                            helperText={
                                nameIsCode
                                    ? _(
                                          'Code in the source; edit it in the editor'
                                      )
                                    : undefined
                            }
                            onChange={(e) => setName(e.target.value)}
                        />
                        <TextField
                            size="small"
                            label={_('Description')}
                            value={description}
                            disabled={descriptionIsCode}
                            helperText={
                                descriptionIsCode
                                    ? _(
                                          'Code in the source; edit it in the editor'
                                      )
                                    : undefined
                            }
                            multiline
                            minRows={3}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        {changedOnDisk && (
                            <Alert
                                severity="warning"
                                action={
                                    <Stack direction="row" gap={1}>
                                        <Button
                                            size="small"
                                            color="inherit"
                                            onClick={reload}
                                        >
                                            {_('Reload')}
                                        </Button>
                                        {dirty && (
                                            <Button
                                                size="small"
                                                color="inherit"
                                                disabled={busy}
                                                onClick={() =>
                                                    void save(dto.version)
                                                }
                                            >
                                                {_('Keep mine')}
                                            </Button>
                                        )}
                                    </Stack>
                                }
                            >
                                {_('Changed on disk')}
                            </Alert>
                        )}
                        {error && !changedOnDisk && (
                            <Alert severity="error">{error}</Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={close}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={busy || !dirty || changedOnDisk}
                        onClick={() => void save(base.version)}
                    >
                        {_('Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);

// ---- References ---------------------------------------------------------------------------------

/** The `409 referenced` answer of a refused delete. */
export const ReferencesModal = ({
    title,
    references,
    close,
}: {
    title: string;
    references: TReferenceDto[];
    close: () => void;
}) => (
    <Dialog open onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
            <Alert severity="info" sx={{ mb: 1 }}>
                {_('Nothing was deleted. Remove these references first:')}
            </Alert>
            <List dense>
                {references.map((r, i) => (
                    <ListItem key={i} disableGutters>
                        <ListItemText
                            primary={`${r.file}:${r.line}${r.passageId ? ` (${r.passageId})` : ''}`}
                            secondary={r.text}
                            primaryTypographyProps={{
                                fontFamily: 'monospace',
                                fontSize: 13,
                            }}
                        />
                    </ListItem>
                ))}
            </List>
        </DialogContent>
        <DialogActions>
            <Button onClick={close}>{_('Close')}</Button>
        </DialogActions>
    </Dialog>
);
