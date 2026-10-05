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
import {
    isCode,
    isValueRecord,
    typeDefault,
    type TCatalogEntryDto,
    type TStructTypeDto,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { FormObjectInput } from '../../components/inputs/form/FormObjectInput';
import { typeContextOf } from '../../components/inputs/structureContext';

import type { EntityStore } from '../../stores/EntityStore';
import type { StructureStore } from '../../stores/StructureStore';
import { writeResult } from '../../stores/writeResult';
import { idErrorMessage, validateEntityId } from './entityFields';

type TProps = {
    type: TStructTypeDto;
    catalog: string;
    entities: EntityStore;
    structure: StructureStore;
    onCreated: (entry: TCatalogEntryDto) => void;
    onCancel: () => void;
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

export const CreateCatalogEntryDialog = observer(
    ({ type, catalog, entities, structure, onCreated, onCancel }: TProps) => {
        const [id, setId] = useState('');
        const [values, setValues] = useState(() =>
            initialValues(type, structure)
        );
        const [touched, setTouched] = useState(false);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const idProblem = validateEntityId(
            id.trim(),
            entities.catalogOf(catalog).map((entry) => entry.id)
        );
        const showIdError = (touched || id !== '') && idProblem;

        const submit = async () => {
            setTouched(true);
            if (idProblem || busy) return;
            setBusy(true);
            setError(null);
            const result = await writeResult(() =>
                entities.createCatalogEntry(catalog, { id: id.trim(), values })
            );
            setBusy(false);
            if (result.status === 'ok') onCreated(result.value);
            else if (result.status === 'invalid')
                setError(
                    result.diagnostics
                        .map((d) => `${d.field ?? d.file}: ${d.message}`)
                        .join('\n')
                );
            else if (result.status === 'exists')
                setError(idErrorMessage('exists'));
            else if (result.status === 'error') setError(result.message);
        };

        return (
            <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <DialogTitle>{_('New %s', type.name)}</DialogTitle>
                    <DialogContent>
                        <Stack gap={2} sx={{ pt: 1 }}>
                            <TextField
                                autoFocus
                                required
                                label={_('id')}
                                value={id}
                                onChange={(e) => setId(e.target.value)}
                                error={!!showIdError}
                                helperText={
                                    showIdError
                                        ? idErrorMessage(idProblem)
                                        : _(
                                              'The key in %s; stored as the value of %s fields.',
                                              type.catalog?.file ?? catalog,
                                              type.name
                                          )
                                }
                                inputProps={{
                                    'spellCheck': false,
                                    'aria-label': 'id',
                                }}
                            />
                            <FormObjectInput
                                label={type.name}
                                value={values}
                                onChange={(next) => {
                                    if (next && !isCode(next)) setValues(next);
                                }}
                                fields={type.fields}
                                hideViewToggle
                                dataField="values"
                            />
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
                            disabled={busy || (touched && !!idProblem)}
                        >
                            {_('Create')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        );
    }
);
