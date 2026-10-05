import { useState } from 'react';
import {
    Alert,
    Autocomplete,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
    TextField,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { structNameError, type TLiteralDto } from '@story/visualizer-protocol';
import { FormLabel } from '../../components/inputs/form/FormLabel';
import { structNameMessage } from '../../components/inputs/StructureInput/structureRows';
import type { StructureStore } from '../../stores/StructureStore';
import { failureMessage } from '../../stores/writeResult';
import { LiteralValuesInput } from './LiteralValuesInput';
import type { TLiteralValueRow } from './StructureEditorStore';

type TProps = {
    structure: StructureStore;
    onCreated: (literal: TLiteralDto) => void;
    onCancel: () => void;
};

type TScope = 'global' | 'local';

const LITERALS_FILE = 'types/literals.ts';

const storyFiles = (structure: StructureStore): string[] =>
    [
        ...new Set([
            ...structure.types.flatMap((type) => [
                type.file,
                ...(type.catalog ? [type.catalog.file] : []),
            ]),
            ...structure.literals.map((literal) => literal.file),
        ]),
    ]
        .filter((file) => file !== LITERALS_FILE)
        .sort();

export const CreateLiteralDialog = observer(
    ({ structure, onCreated, onCancel }: TProps) => {
        const [name, setName] = useState('');
        const [rows, setRows] = useState<TLiteralValueRow[]>([]);
        const [scope, setScope] = useState<TScope>('global');
        const [file, setFile] = useState('');
        const [touched, setTouched] = useState(false);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const taken = [...structure.typeNames, ...structure.literalNames];
        const nameError = structNameError(name.trim(), taken);
        const showNameError = (touched || name !== '') && nameError;
        const values = rows.map((row) => row.value);
        const valuesError =
            values.length === 0
                ? _('Add at least one value')
                : new Set(values).size !== values.length || values.includes('')
                  ? _('Values must be unique and not empty')
                  : null;
        const fileError =
            scope === 'local' && !/^(data|types)\/.+\.ts$/.test(file.trim())
                ? _('A story file under data/ or types/')
                : null;
        const invalid = !!nameError || !!valuesError || !!fileError;

        const submit = async () => {
            setTouched(true);
            if (invalid || busy) return;
            setBusy(true);
            setError(null);
            const result = await structure.createLiteral({
                name: name.trim(),
                values,
                ...(scope === 'local' ? { file: file.trim() } : {}),
            });
            setBusy(false);
            if (result.status === 'ok') onCreated(result.value);
            else
                setError(
                    failureMessage(result, _('Not created: %s', name.trim()))
                );
        };

        return (
            <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    <DialogTitle>{_('New literal')}</DialogTitle>
                    <DialogContent>
                        <Stack gap={2} sx={{ pt: 1 }}>
                            <TextField
                                autoFocus
                                required
                                label={_('name')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                error={!!showNameError}
                                helperText={
                                    showNameError
                                        ? structNameMessage(showNameError)
                                        : _('e.g. TMood')
                                }
                                inputProps={{
                                    'spellCheck': false,
                                    'aria-label': 'name',
                                }}
                            />
                            <FormLabel
                                label={_('values')}
                                warning={
                                    touched
                                        ? (valuesError ?? undefined)
                                        : undefined
                                }
                                helperText={
                                    touched
                                        ? (valuesError ?? undefined)
                                        : undefined
                                }
                            >
                                <LiteralValuesInput
                                    value={rows}
                                    onChange={setRows}
                                    ariaLabel={_('values')}
                                />
                            </FormLabel>
                            <RadioGroup
                                row
                                value={scope}
                                onChange={(e) =>
                                    setScope(
                                        e.target.value === 'local'
                                            ? 'local'
                                            : 'global'
                                    )
                                }
                            >
                                <FormControlLabel
                                    value="global"
                                    control={<Radio size="small" />}
                                    label={_('Global (%s)', LITERALS_FILE)}
                                />
                                <FormControlLabel
                                    value="local"
                                    control={<Radio size="small" />}
                                    label={_('Local to a file')}
                                />
                            </RadioGroup>
                            {scope === 'local' && (
                                <Autocomplete
                                    freeSolo
                                    size="small"
                                    options={storyFiles(structure)}
                                    inputValue={file}
                                    onInputChange={(_e, value) =>
                                        setFile(value)
                                    }
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={_('file')}
                                            error={touched && !!fileError}
                                            helperText={
                                                touched ? fileError : undefined
                                            }
                                        />
                                    )}
                                />
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
                            disabled={busy || (touched && invalid)}
                        >
                            {_('Create')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        );
    }
);
