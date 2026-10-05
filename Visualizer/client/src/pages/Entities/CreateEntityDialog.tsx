import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { TEntityDto, TEntityKind } from '@story/visualizer-protocol';
import { ApiError } from '../../api';
import { FormLiteralInput } from '../../components/inputs/form/FormLiteralInput';
import type { EntityStore } from '../../stores/EntityStore';
import type { StructureStore } from '../../stores/StructureStore';
import {
    buildCreateBody,
    createFields,
    ENTITY_TYPE_NAMES,
    idErrorMessage,
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

type Props = {
    kind: TEntityKind;
    entities: EntityStore;
    structure: StructureStore;
    onCreated: (entity: TEntityDto) => void;
    onCancel: () => void;
};

const ITEM_TYPE_LITERAL = 'TItemType';

const itemTypeLiteral = (structure: StructureStore): string => {
    const type = structure
        .fieldsOf(ENTITY_TYPE_NAMES.items.entity)
        .find((field) => field.key === 'type')?.type;
    return type?.t === 'literal' ? type.name : ITEM_TYPE_LITERAL;
};

export const CreateEntityDialog = observer(
    ({ kind, entities, structure, onCreated, onCancel }: Props) => {
        const typeLiteral = itemTypeLiteral(structure);
        const typeOptions = structure.literalValues(typeLiteral);
        const [form, setForm] = useState<TCreateForm>(() => ({
            id: '',
            name: '',
            description: '',
            type: typeOptions.includes('value')
                ? 'value'
                : (typeOptions[0] ?? 'value'),
        }));
        const [touched, setTouched] = useState(false);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const fields = createFields(kind);

        const idProblem = validateEntityId(
            form.id.trim(),
            entities.idsOf(kind)
        );
        const descriptionMissing =
            fields.description === 'required' && form.description.trim() === '';
        const canSubmit = !idProblem && !descriptionMissing && !busy;

        const submit = async () => {
            setTouched(true);
            if (!canSubmit) return;
            setBusy(true);
            setError(null);
            try {
                onCreated(
                    await entities.create(kind, buildCreateBody(kind, form))
                );
            } catch (e) {
                if (e instanceof ApiError && e.isInvalid) {
                    setError(
                        e.diagnostics
                            .map((d) => `${d.file}:${d.line} ${d.message}`)
                            .join('\n')
                    );
                } else if (e instanceof ApiError && e.code === 'exists') {
                    setError(idErrorMessage('exists'));
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
                                        ? idErrorMessage(idProblem)
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
                                <FormLiteralInput
                                    label={_('type')}
                                    value={form.type}
                                    onChange={(type) =>
                                        set({ type: type ?? form.type })
                                    }
                                    options={typeOptions}
                                    onCreateOption={(value) =>
                                        structure.addLiteralValue(
                                            typeLiteral,
                                            value
                                        )
                                    }
                                    helperText={_(
                                        'Goes into data/items/%s.ts',
                                        itemSourceForType(form.type)
                                    )}
                                    dataField="type"
                                />
                            )}
                            {fields.type && structure.writeError && (
                                <Alert
                                    severity="error"
                                    onClose={structure.dismissWriteError}
                                >
                                    {structure.writeError}
                                </Alert>
                            )}
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
    }
);
