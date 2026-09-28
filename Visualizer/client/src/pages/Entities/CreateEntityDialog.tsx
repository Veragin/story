import { useState } from 'react';
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
import type { TEntityDto, TEntityKind } from '@story/visualizer-protocol';
import { ApiError } from '../../api';
import type { EntitiesStore } from './EntitiesStore';
import {
    buildCreateBody,
    createFields,
    ITEM_TYPE_PROPS,
    ITEM_TYPES,
    itemSourceForType,
    validateEntityId,
    type TCreateForm,
} from './entityFields';

const TITLE: Record<TEntityKind, () => string> = {
    characters: () => _('New character'),
    npcs: () => _('New NPC'),
    locations: () => _('New location'),
    items: () => _('New item'),
};

const ID_ERRORS: Record<string, () => string> = {
    required: () => _('Required'),
    dash: () =>
        _('Ids must not contain "-" (it separates the parts of passage ids).'),
    identifier: () =>
        _('Start with a lower-case letter; then letters, digits and "_" only.'),
    exists: () => _('This id is taken.'),
};

type Props = {
    kind: TEntityKind;
    store: EntitiesStore;
    onCreated: (entity: TEntityDto) => void;
    onCancel: () => void;
};

/**
 * "Add" of the entity list: the id (validated like the server expects: a plain identifier
 * without `-`, unique in its kind) and the fields the type requires (`name`, `description`;
 * `type` for items, which also picks the items file).
 */
export const CreateEntityDialog = ({
    kind,
    store,
    onCreated,
    onCancel,
}: Props) => {
    const [form, setForm] = useState<TCreateForm>({
        id: '',
        name: '',
        description: '',
        type: 'value',
    });
    const [touched, setTouched] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fields = createFields(kind);

    const idProblem = validateEntityId(form.id.trim(), store.idsOf(kind));
    const descriptionMissing =
        fields.description === 'required' && form.description.trim() === '';
    const canSubmit = !idProblem && !descriptionMissing && !busy;

    const submit = async () => {
        setTouched(true);
        if (!canSubmit) return;
        setBusy(true);
        setError(null);
        try {
            onCreated(await store.create(kind, buildCreateBody(kind, form)));
        } catch (e) {
            if (e instanceof ApiError && e.isInvalid) {
                setError(
                    e.diagnostics
                        .map((d) => `${d.file}:${d.line} ${d.message}`)
                        .join('\n')
                );
            } else if (e instanceof ApiError && e.code === 'exists') {
                setError(ID_ERRORS.exists());
            } else if (e instanceof ApiError && e.isNotImplemented) {
                setError(
                    _(
                        'The server does not implement creating entities yet (501).'
                    )
                );
            } else {
                setError(e instanceof Error ? e.message : String(e));
            }
        } finally {
            setBusy(false);
        }
    };

    const set = (patch: Partial<TCreateForm>) =>
        setForm((f) => ({ ...f, ...patch }));
    const showIdError = (touched || form.id !== '') && idProblem;

    return (
        <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <DialogTitle>{TITLE[kind]()}</DialogTitle>
                <DialogContent>
                    <Stack gap={2} sx={{ pt: 1 }}>
                        <TextField
                            autoFocus
                            required
                            label={_('id')}
                            value={form.id}
                            onChange={(e) => set({ id: e.target.value })}
                            error={!!showIdError}
                            helperText={
                                showIdError
                                    ? ID_ERRORS[idProblem]()
                                    : _(
                                          'Used in code and file names; cannot be changed later.'
                                      )
                            }
                            inputProps={{
                                'spellCheck': false,
                                'aria-label': 'id',
                            }}
                        />
                        <TextField
                            label={_('name')}
                            value={form.name}
                            placeholder={form.id}
                            onChange={(e) => set({ name: e.target.value })}
                            helperText={_('Defaults to the id.')}
                        />
                        {fields.description !== 'none' && (
                            <TextField
                                label={_('description')}
                                required={fields.description === 'required'}
                                multiline
                                minRows={2}
                                value={form.description}
                                onChange={(e) =>
                                    set({ description: e.target.value })
                                }
                                error={touched && descriptionMissing}
                            />
                        )}
                        {fields.type && (
                            <TextField
                                select
                                label={_('type')}
                                value={form.type}
                                onChange={(e) => set({ type: e.target.value })}
                                helperText={_(
                                    'Goes into data/items/%s.ts',
                                    itemSourceForType(form.type)
                                )}
                            >
                                {ITEM_TYPES.map((t) => (
                                    <MenuItem key={t} value={t}>
                                        {t}
                                    </MenuItem>
                                ))}
                            </TextField>
                        )}
                        {fields.type &&
                            (ITEM_TYPE_PROPS[form.type] ?? []).map((p) => (
                                <TextField
                                    key={`${form.type}.${p.key}`}
                                    label={p.key}
                                    type={
                                        p.kind === 'number' ? 'number' : 'text'
                                    }
                                    value={String(
                                        form.props?.[p.key] ??
                                            (p.kind === 'number' ? 0 : '')
                                    )}
                                    onChange={(e) =>
                                        set({
                                            props: {
                                                ...form.props,
                                                [p.key]:
                                                    p.kind === 'number'
                                                        ? Number(
                                                              e.target.value
                                                          ) || 0
                                                        : e.target.value,
                                            },
                                        })
                                    }
                                />
                            ))}
                        {error && (
                            <Alert
                                severity="error"
                                sx={{ whiteSpace: 'pre-wrap' }}
                            >
                                {error}
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={onCancel}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={busy || (touched && !canSubmit)}
                    >
                        {_('Create')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
