import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    structNameError,
    type TFieldDesc,
    type TStructTypeDto,
} from '@story/protocol';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { FormCheckbox } from '../../components/form/FormCheckbox';
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

// a catalog entry is listed by its name
const CATALOG_FIELDS: TFieldDesc[] = [
    { key: 'name', type: { t: 'string' }, optional: false },
];

export const CreateTypeDialog = observer(
    ({ structure, onCreated, onClose }: TProps) => {
        const [name, setName] = useState('');
        const [hasCatalog, setHasCatalog] = useState(true);
        const [plural, setPlural] = useState<string | null>(null);

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

        const { busy, error, touched, submit, setError } = useDialogSubmit(
            async () => {
                const result = await structure.createType({
                    name: name.trim(),
                    fields: hasCatalog ? CATALOG_FIELDS : [],
                    ...(hasCatalog ? { catalog: { name: catalogName } } : {}),
                });
                if (result.status === 'ok') onCreated(result.value);
                else
                    setError(
                        failureMessage(
                            result,
                            _('Not created: %s', name.trim())
                        )
                    );
            },
            { canSubmit: !nameError && !catalogError }
        );
        const showNameError = (touched || name !== '') && nameError;

        return (
            <AppDialog
                title={_('New type')}
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
                        showNameError ? structNameMessage(showNameError) : null
                    }
                    helperText={_('Goes into types/%s.ts', name || 'T…')}
                    spellCheck={false}
                    dataField="name"
                />
                <FormCheckbox
                    label={_('Has a catalog')}
                    helperText={_(
                        'Has instances (a catalog), so fields can reference it'
                    )}
                    value={hasCatalog}
                    onChange={(next) => setHasCatalog(next ?? false)}
                    dataField="catalog"
                />
                {hasCatalog && (
                    <FormTextInput
                        label={_('Catalog name')}
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
                )}
            </AppDialog>
        );
    }
);
