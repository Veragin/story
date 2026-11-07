import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { structNameError, type TLiteralDto } from '@story/protocol';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { FormAutocompleteInput } from '../../components/form/FormAutocompleteInput';
import { FormRadioInput } from '../../components/form/FormRadioInput';
import { FormStringListInput } from '../../components/form/FormStringListInput';
import { FormTextInput } from '../../components/form/FormTextInput';
import { optionsOf } from '../../structure/option';
import { structNameMessage } from '../../structure/structureRows';
import type { StructureStore } from '../../stores/StructureStore';
import { failureMessage } from '../../stores/writeResult';

type TProps = {
    structure: StructureStore;
    owner?: string;
    onCreated: (literal: TLiteralDto) => void;
    onClose: () => void;
};

type TScope = 'global' | 'local' | 'private';

const SCOPES: readonly TScope[] = ['global', 'local', 'private'];

const isScope = (value: string | undefined): value is TScope =>
    SCOPES.some((scope) => scope === value);

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

// a private literal is declared in its class's file under types/
const ownerClasses = (structure: StructureStore): string[] =>
    structure.classes
        .filter((type) => type.file.startsWith('types/'))
        .map((type) => type.name);

export const CreateLiteralDialog = observer(
    ({ structure, owner, onCreated, onClose }: TProps) => {
        const [name, setName] = useState('');
        const [values, setValues] = useState<string[]>([]);
        const [scope, setScope] = useState<TScope>(
            owner ? 'private' : 'global'
        );
        const [file, setFile] = useState('');
        const [ownerClass, setOwnerClass] = useState(owner ?? '');

        const taken = [...structure.typeNames, ...structure.literalNames];
        const nameError = structNameError(name.trim(), taken, 'type');
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
        const ownerError =
            scope === 'private' && !structure.type(ownerClass.trim())
                ? _('Pick a class')
                : null;
        const invalid =
            !!nameError || !!valuesError || !!fileError || !!ownerError;

        const { busy, error, touched, submit, setError } = useDialogSubmit(
            async () => {
                const result = await structure.createLiteral({
                    name: name.trim(),
                    values,
                    ...(scope === 'local' ? { file: file.trim() } : {}),
                    ...(scope === 'private'
                        ? { owner: ownerClass.trim() }
                        : {}),
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
            { canSubmit: !invalid }
        );
        const showNameError = (touched || name !== '') && nameError;

        return (
            <AppDialog
                title={
                    owner
                        ? _('New private literal of %s', owner)
                        : _('New literal')
                }
                onClose={onClose}
                onSubmit={submit}
                error={error}
                actions={
                    <DialogButtons
                        submit
                        onClose={onClose}
                        label={_('Create')}
                        busy={busy}
                        disabled={touched && invalid}
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
                    helperText={_('e.g. TMood')}
                    spellCheck={false}
                    dataField="name"
                />
                <FormStringListInput
                    label={_('Values')}
                    value={values}
                    onChange={(next) => setValues(next ?? [])}
                    error={touched ? valuesError : null}
                    dataField="values"
                />
                <FormRadioInput
                    label={_('Scope')}
                    row
                    value={scope}
                    onChange={(next) =>
                        setScope(isScope(next) ? next : 'global')
                    }
                    options={[
                        {
                            id: 'global',
                            label: _('Global (%s)', LITERALS_FILE),
                        },
                        {
                            id: 'local',
                            label: _('Local to a file'),
                        },
                        {
                            id: 'private',
                            label: ownerClass
                                ? _('Private (class %s)', ownerClass)
                                : _('Private to a class'),
                        },
                    ]}
                    dataField="scope"
                />
                {scope === 'local' && (
                    <FormAutocompleteInput
                        label={_('File')}
                        freeSolo
                        value={file}
                        onChange={(next) => setFile(next ?? '')}
                        options={optionsOf(storyFiles(structure))}
                        error={touched ? fileError : null}
                        dataField="file"
                    />
                )}
                {scope === 'private' && !owner && (
                    <FormAutocompleteInput
                        label={_('Class')}
                        value={ownerClass}
                        onChange={(next) => setOwnerClass(next ?? '')}
                        options={optionsOf(ownerClasses(structure))}
                        error={touched ? ownerError : null}
                        dataField="owner"
                    />
                )}
            </AppDialog>
        );
    }
);
