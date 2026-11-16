import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { TEntityDto, TEntityKind } from '@story/protocol';
import { ApiError, errorMessage } from '../../api';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { FormAutocompleteInput } from '../../components/form/FormAutocompleteInput';
import { FormTextInput } from '../../components/form/FormTextInput';
import { TitleIdInput } from '../../components/form/TitleIdInput';
import { useTitleId } from '../../components/form/useTitleId';
import { optionsOf } from '../../structure/option';
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

type TProps = {
    kind: TEntityKind;
    entities: EntityStore;
    structure: StructureStore;
    onCreated: (entity: TEntityDto) => void;
    onClose: () => void;
};

type TFormFields = Omit<TCreateForm, 'id' | 'name'>;

const ITEM_TYPE_LITERAL = 'TItemType';

const itemTypeLiteral = (structure: StructureStore): string => {
    const type = structure
        .fieldsOf(ENTITY_TYPE_NAMES.items.entity)
        .find((field) => field.key === 'type')?.type;
    return type?.t === 'literal' ? type.name : ITEM_TYPE_LITERAL;
};

const createError = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'exists')
        return idErrorMessage('exists');
    if (e instanceof ApiError && e.isNotImplemented)
        return _('The server does not implement creating entities yet (501).');
    return errorMessage(e);
};

export const CreateEntityDialog = observer(
    ({ kind, entities, structure, onCreated, onClose }: TProps) => {
        const typeLiteral = itemTypeLiteral(structure);
        const typeOptions = structure.literalValues(typeLiteral);
        const [form, setForm] = useState<TFormFields>(() => ({
            description: '',
            type: typeOptions.includes('value')
                ? 'value'
                : (typeOptions[0] ?? 'value'),
        }));
        const fields = createFields(kind);
        const existingIds = entities.idsOf(kind);
        const titleId = useTitleId(
            ENTITY_TYPE_NAMES[kind].entity.toLowerCase(),
            (id) => validateEntityId(id, existingIds) === 'exists'
        );

        const idProblem = validateEntityId(titleId.id, existingIds);
        const descriptionMissing =
            fields.description === 'required' && form.description.trim() === '';
        const canSubmit = !idProblem && !descriptionMissing;

        const { busy, error, touched, submit } = useDialogSubmit(
            async () =>
                onCreated(
                    await entities.create(
                        kind,
                        buildCreateBody(kind, {
                            ...form,
                            id: titleId.id,
                            name: titleId.title,
                        })
                    )
                ),
            { canSubmit, toError: createError }
        );

        const set = (patch: Partial<TFormFields>) =>
            setForm((f) => ({ ...f, ...patch }));
        const showIdError = (touched || titleId.id !== '') && idProblem;

        return (
            <AppDialog
                title={TITLE[kind]()}
                onClose={onClose}
                onSubmit={submit}
                error={error}
                actions={
                    <DialogButtons
                        onClose={onClose}
                        label={_('Create')}
                        busyLabel={_('Creating…')}
                        busy={busy}
                        disabled={touched && !canSubmit}
                        submit
                    />
                }
            >
                <TitleIdInput
                    state={titleId}
                    label={_('Name')}
                    autoFocus
                    idError={showIdError ? idErrorMessage(idProblem) : null}
                    idHelperText={_(
                        'Used in code and file names; cannot be changed later.'
                    )}
                    titleDataField="name"
                />
                {fields.description !== 'none' && (
                    <FormTextInput
                        label={_('Description')}
                        multiline
                        value={form.description}
                        onChange={(description = '') => set({ description })}
                        error={
                            touched && descriptionMissing ? _('Required') : null
                        }
                        dataField="description"
                    />
                )}
                {fields.type && (
                    <FormAutocompleteInput
                        label={_('Type')}
                        value={form.type}
                        onChange={(type) => set({ type: type ?? form.type })}
                        options={optionsOf(typeOptions)}
                        onCreateOption={(value) =>
                            structure.addLiteralValue(typeLiteral, value)
                        }
                        helperText={_(
                            'Goes into data/items/%s.ts',
                            itemSourceForType(form.type)
                        )}
                        dataField="type"
                    />
                )}
                {fields.type && (
                    <ErrorAlert
                        error={structure.writeError}
                        onClose={structure.dismissWriteError}
                    />
                )}
            </AppDialog>
        );
    }
);
