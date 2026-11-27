import { observer } from 'mobx-react-lite';
import type { TNpcDto } from '@story/protocol';
import { FormImageEditor } from '../../components/editors/FormImageEditor';
import { FormMaybeCodeTextInput } from '../../components/code/FormMaybeCodeTextInput';
import { DataTypeField } from './DataTypeField';
import type { TEntityFieldsProps } from './entityFormProps';
import { ENTITY_TYPE_NAMES } from './entityFields';
import { InitField } from './InitField';
import { UserFields } from './UserFields';

const TYPES = ENTITY_TYPE_NAMES.npcs;

export const NpcFields = observer(
    ({ store, structure, draft }: TEntityFieldsProps<TNpcDto>) => (
        <>
            <FormMaybeCodeTextInput
                label={_('Name')}
                value={draft.name}
                onChange={(next) => store.setField('name', next)}
                diagnostics={store.exactDiagnostics('name')}
                dataField="name"
            />
            <FormMaybeCodeTextInput
                label={_('Description')}
                multiline
                value={draft.description}
                onChange={(next) => store.setField('description', next)}
                diagnostics={store.exactDiagnostics('description')}
                dataField="description"
            />
            <FormImageEditor
                label={_('Image')}
                api={store.entities.api}
                owner="npcs"
                id={draft.id}
                value={draft.image}
                onChange={(next) => store.setField('image', next)}
                diagnostics={store.fieldDiagnostics('image')}
            />
            <UserFields
                store={store}
                structure={structure}
                typeName={TYPES.entity}
                values={draft.userFields}
            />
            <InitField
                store={store}
                structure={structure}
                baseType={TYPES.data}
                dataType={draft.dataType}
                value={draft.init}
            />
            <DataTypeField
                store={store}
                entity={draft}
                dataType={draft.dataType}
                suffix="Npc"
            />
        </>
    )
);
