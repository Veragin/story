import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { structNameError, type TStructTypeDto } from '@story/protocol';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { FormTextInput } from '../../components/form/FormTextInput';
import { structNameMessage } from '../../structure/structureRows';
import type { StructureStore } from '../../stores/StructureStore';
import { failureMessage } from '../../stores/writeResult';

type TProps = {
    structure: StructureStore;
    owner?: string;
    onCreated: (type: TStructTypeDto) => void;
    onClose: () => void;
};

export const CreateTypeDialog = observer(
    ({ structure, owner, onCreated, onClose }: TProps) => {
        const [name, setName] = useState('');

        const trimmed = name.trim();
        const taken = [...structure.typeNames, ...structure.literalNames];
        const nameError = structNameError(trimmed, taken, 'type');
        const ownerFile = owner ? structure.type(owner)?.file : undefined;

        const { busy, error, touched, submit, setError } = useDialogSubmit(
            async () => {
                const result = await structure.createType({
                    kind: 'type',
                    name: trimmed,
                    fields: [],
                    ...(owner ? { owner } : {}),
                });
                if (result.status === 'ok') onCreated(result.value);
                else
                    setError(
                        failureMessage(result, _('Not created: %s', trimmed))
                    );
            },
            { canSubmit: !nameError }
        );
        const showNameError = (touched || name !== '') && nameError;

        return (
            <AppDialog
                title={
                    owner ? _('New private type of %s', owner) : _('New type')
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
                        disabled={touched && !!nameError}
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
                    helperText={
                        ownerFile
                            ? _('Goes into %s, usable only there', ownerFile)
                            : _(
                                  'Goes into types/%s.ts; a field of this type holds an object of its fields',
                                  trimmed || 'T…'
                              )
                    }
                    spellCheck={false}
                    dataField="name"
                />
            </AppDialog>
        );
    }
);
