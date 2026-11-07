import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    refIdTypeName,
    structNameError,
    type TFieldDesc,
    type TStructTypeDto,
} from '@story/protocol';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { FormTextInput } from '../../components/form/FormTextInput';
import { structNameMessage } from '../../structure/structureRows';
import type { StructureStore } from '../../stores/StructureStore';
import { failureMessage } from '../../stores/writeResult';
import { catalogNameOf } from './structureText';

type TProps = {
    structure: StructureStore;
    onCreated: (type: TStructTypeDto) => void;
    onClose: () => void;
};

const CATALOG_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

// an entry is listed by its name
const CLASS_FIELDS: TFieldDesc[] = [
    { key: 'name', type: { t: 'string' }, optional: false },
];

export const CreateClassDialog = observer(
    ({ structure, onCreated, onClose }: TProps) => {
        const [name, setName] = useState('');
        const [plural, setPlural] = useState<string | null>(null);

        const trimmed = name.trim();
        const catalogName = plural ?? catalogNameOf(trimmed);
        const taken = [...structure.typeNames, ...structure.literalNames];
        const nameError = structNameError(trimmed, taken, 'class');
        const takenCatalogs = structure.types.flatMap(
            (type) => type.catalog?.name ?? []
        );
        const catalogError = !CATALOG_NAME_RE.test(catalogName)
            ? _('A lower-case identifier, e.g. races')
            : takenCatalogs.includes(catalogName)
              ? _('That name is already used by another class')
              : null;

        const { busy, error, touched, submit, setError } = useDialogSubmit(
            async () => {
                const result = await structure.createType({
                    kind: 'class',
                    name: trimmed,
                    fields: CLASS_FIELDS,
                    catalog: { name: catalogName },
                });
                if (result.status === 'ok') onCreated(result.value);
                else
                    setError(
                        failureMessage(result, _('Not created: %s', trimmed))
                    );
            },
            { canSubmit: !nameError && !catalogError }
        );
        const showNameError = (touched || name !== '') && nameError;

        return (
            <AppDialog
                title={_('New class')}
                onClose={onClose}
                onSubmit={submit}
                error={error}
                actions={
                    <DialogButtons
                        submit
                        onClose={onClose}
                        label={_('Create')}
                        busy={busy}
                        disabled={touched && (!!nameError || !!catalogError)}
                    />
                }
            >
                <FormTextInput
                    autoFocus
                    label={_('Name')}
                    value={name}
                    onChange={(next) => setName(next ?? '')}
                    error={
                        showNameError
                            ? structNameMessage(showNameError, 'class')
                            : null
                    }
                    helperText={_(
                        'Goes into types/%s.ts; fields store its id, %s',
                        trimmed || '…',
                        trimmed ? refIdTypeName(trimmed) : 'T…Id'
                    )}
                    spellCheck={false}
                    dataField="name"
                />
                <FormTextInput
                    label={_('Plural name')}
                    value={catalogName}
                    onChange={(next) => setPlural(next ?? '')}
                    error={catalogError}
                    helperText={_(
                        'data/catalogs/%s.ts; its entries are edited in Entities.',
                        catalogName || '…'
                    )}
                    spellCheck={false}
                    dataField="catalogName"
                />
            </AppDialog>
        );
    }
);
