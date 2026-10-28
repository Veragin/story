import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    isCode,
    isValueRecord,
    typeDefault,
    type TCatalogEntryDto,
    type TStructTypeDto,
    type TValueRecord,
} from '@story/protocol';
import { errorMessage } from '../../api';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { ObjectEditor } from '../../components/editors/ObjectEditor/ObjectEditor';
import { FormTextInput } from '../../components/form/FormTextInput';
import { typeContextOf } from '../../structure/structureContext';
import type { EntityStore } from '../../stores/EntityStore';
import type { StructureStore } from '../../stores/StructureStore';
import { failureOf } from '../../stores/writeResult';
import { idErrorMessage, validateEntityId } from './entityFields';

type TProps = {
    type: TStructTypeDto;
    catalog: string;
    entities: EntityStore;
    structure: StructureStore;
    onCreated: (entry: TCatalogEntryDto) => void;
    onClose: () => void;
};

const initialValues = (
    type: TStructTypeDto,
    structure: StructureStore
): TValueRecord => {
    const values = typeDefault(
        { t: 'object', fields: type.fields },
        typeContextOf(structure)
    );
    return isValueRecord(values) ? values : {};
};

const createError = (e: unknown) => {
    const failure = failureOf(e);
    if (failure.status === 'invalid')
        return failure.diagnostics
            .map((d) => `${d.field ?? d.file}: ${d.message}`)
            .join('\n');
    if (failure.status === 'exists') return idErrorMessage('exists');
    return errorMessage(e);
};

export const CreateCatalogEntryDialog = observer(
    ({ type, catalog, entities, structure, onCreated, onClose }: TProps) => {
        const [id, setId] = useState('');
        const [values, setValues] = useState(() =>
            initialValues(type, structure)
        );

        const idProblem = validateEntityId(
            id.trim(),
            entities.catalogOf(catalog).map((entry) => entry.id)
        );

        const { busy, error, touched, submit } = useDialogSubmit(
            async () =>
                onCreated(
                    await entities.createCatalogEntry(catalog, {
                        id: id.trim(),
                        values,
                    })
                ),
            { canSubmit: !idProblem, toError: createError }
        );
        const showIdError = (touched || id !== '') && idProblem;

        return (
            <AppDialog
                title={_('New %s', type.name)}
                onClose={onClose}
                onSubmit={submit}
                error={error}
                actions={
                    <DialogButtons
                        onClose={onClose}
                        label={_('Create')}
                        busyLabel={_('Creating…')}
                        busy={busy}
                        disabled={touched && !!idProblem}
                        submit
                    />
                }
            >
                <FormTextInput
                    autoFocus
                    spellCheck={false}
                    label={_('Id')}
                    value={id}
                    onChange={(next = '') => setId(next)}
                    error={showIdError ? idErrorMessage(idProblem) : null}
                    helperText={_(
                        'The key in %s; stored as the value of %s fields.',
                        type.catalog?.file ?? catalog,
                        type.name
                    )}
                    dataField="id"
                />
                <ObjectEditor
                    ariaLabel={type.name}
                    value={values}
                    onChange={(next) => {
                        if (!isCode(next)) setValues(next);
                    }}
                    fields={type.fields}
                    hideViewToggle
                    dataField="values"
                />
            </AppDialog>
        );
    }
);
