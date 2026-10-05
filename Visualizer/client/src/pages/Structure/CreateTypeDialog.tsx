import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import {
    structNameError,
    type TFieldDesc,
    type TStructTypeDto,
} from '@story/visualizer-protocol';
import { structNameMessage } from '../../components/inputs/StructureInput/structureRows';
import type { StructureStore } from '../../stores/StructureStore';
import { failureMessage } from '../../stores/writeResult';
import { catalogNameOf } from './structureText';

type TProps = {
    structure: StructureStore;
    onCreated: (type: TStructTypeDto) => void;
    onCancel: () => void;
};

const CATALOG_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

// a catalog entry is listed by its name
const CATALOG_FIELDS: TFieldDesc[] = [
    { key: 'name', type: { t: 'string' }, optional: false },
];

export const CreateTypeDialog = observer(
    ({ structure, onCreated, onCancel }: TProps) => {
        const [name, setName] = useState('');
        const [hasCatalog, setHasCatalog] = useState(true);
        const [plural, setPlural] = useState<string | null>(null);
        const [touched, setTouched] = useState(false);
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const catalogName = plural ?? catalogNameOf(name.trim());
        const taken = [...structure.typeNames, ...structure.literalNames];
        const nameError = structNameError(name.trim(), taken);
        const takenCatalogs = structure.types.flatMap(
            (type) => type.catalog?.name ?? []
        );
        const catalogError = !hasCatalog
            ? null
            : !CATALOG_NAME_RE.test(catalogName)
              ? _('A lower-case identifier, e.g. races')
              : takenCatalogs.includes(catalogName)
                ? _('That catalog exists')
                : null;
        const showNameError = (touched || name !== '') && nameError;

        const submit = async () => {
            setTouched(true);
            if (nameError || catalogError || busy) return;
            setBusy(true);
            setError(null);
            const result = await structure.createType({
                name: name.trim(),
                fields: hasCatalog ? CATALOG_FIELDS : [],
                ...(hasCatalog ? { catalog: { name: catalogName } } : {}),
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
                    <DialogTitle>{_('New type')}</DialogTitle>
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
                                        : _(
                                              'Goes into types/%s.ts',
                                              name || 'T…'
                                          )
                                }
                                inputProps={{
                                    'spellCheck': false,
                                    'aria-label': 'name',
                                }}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={hasCatalog}
                                        onChange={(e) =>
                                            setHasCatalog(e.target.checked)
                                        }
                                        inputProps={{
                                            'aria-label': 'catalog',
                                        }}
                                    />
                                }
                                label={_(
                                    'Has instances (a catalog), so fields can reference it'
                                )}
                            />
                            {hasCatalog && (
                                <TextField
                                    label={_('catalog name')}
                                    value={catalogName}
                                    onChange={(e) => setPlural(e.target.value)}
                                    error={!!catalogError}
                                    helperText={
                                        catalogError ??
                                        _(
                                            'data/catalogs/%s.ts; its entries are edited in Entities.',
                                            catalogName || '…'
                                        )
                                    }
                                    inputProps={{
                                        'spellCheck': false,
                                        'aria-label': 'catalog name',
                                    }}
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
                            disabled={
                                busy ||
                                (touched && (!!nameError || !!catalogError))
                            }
                        >
                            {_('Create')}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        );
    }
);
