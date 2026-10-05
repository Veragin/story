import { observer } from 'mobx-react-lite';
import type { TNpcDto } from '@story/visualizer-protocol';
import { FormImageInput } from '../../components/inputs/form/FormImageInput';
import { FormStringInput } from '../../components/inputs/form/FormStringInput';
import { DataTypeInput } from './DataTypeInput';
import type { TEntityFieldsProps } from './entityFormProps';
import { ENTITY_TYPE_NAMES } from './entityFields';
import { InitInput } from './InitInput';
import { UserFieldsInput } from './UserFieldsInput';

const TYPES = ENTITY_TYPE_NAMES.npcs;

export const NpcFields = observer(
    ({ store, structure, draft }: TEntityFieldsProps<TNpcDto>) => (
        <>
            <FormStringInput
                label="name"
                value={draft.name}
                onChange={(next) => store.setField('name', next)}
                diagnostics={store.exactDiagnostics('name')}
                dataField="name"
            />
            <FormStringInput
                label="description"
                multiline
                value={draft.description}
                onChange={(next) => store.setField('description', next)}
                diagnostics={store.exactDiagnostics('description')}
                dataField="description"
            />
            <FormImageInput
                api={store.entities.api}
                owner="npcs"
                id={draft.id}
                description={draft.image}
                onDescriptionChange={(next) => store.setField('image', next)}
                diagnostics={store.fieldDiagnostics('image')}
            />
            <UserFieldsInput
                store={store}
                structure={structure}
                typeName={TYPES.entity}
                values={draft.userFields}
            />
            <InitInput
                store={store}
                structure={structure}
                baseType={TYPES.data}
                dataType={draft.dataType}
                value={draft.init}
            />
            <DataTypeInput
                store={store}
                entity={draft}
                dataType={draft.dataType}
                suffix="Npc"
            />
        </>
    )
);
