import { observer } from 'mobx-react-lite';
import type { TLocationDto, TTypeRef } from '@story/protocol';
import { FormArrayEditor } from '../../components/editors/FormArrayEditor';
import { FormMaybeCodeTextInput } from '../../components/code/FormMaybeCodeTextInput';
import {
    StructureContext,
    withoutRefOption,
} from '../../structure/structureContext';
import { HintText } from '../../components/feedback/HintText';
import { router } from '../../shell';
import { LOCAL_CHARACTER_TYPE } from '../../typeRefs';
import { DataTypeField } from './DataTypeField';
import type { TEntityFieldsProps } from './entityFormProps';
import { ENTITY_TYPE_NAMES } from './entityFields';
import { InitField } from './InitField';
import { UserFields } from './UserFields';

const TYPES = ENTITY_TYPE_NAMES.locations;

const LOCATION_REF: TTypeRef = { t: 'ref', name: 'TLocation' };

export const LocationFields = observer(
    ({ store, structure, draft }: TEntityFieldsProps<TLocationDto>) => (
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
            <FormArrayEditor
                label={_('Local characters')}
                itemType={LOCAL_CHARACTER_TYPE}
                value={draft.localCharacters}
                onChange={(next) =>
                    store.setField('localCharacters', next ?? [])
                }
                diagnostics={store.exactDiagnostics('localCharacters')}
                diagnosticsOf={store.diagnosticsUnder('localCharacters')}
                dataField="localCharacters"
            />
            <StructureContext.Provider
                value={withoutRefOption(structure, 'TLocation', draft.id)}
            >
                <FormArrayEditor
                    label={_('Sublocations')}
                    optional
                    itemType={LOCATION_REF}
                    value={draft.sublocations}
                    onChange={(next) => store.setField('sublocations', next)}
                    diagnostics={store.exactDiagnostics('sublocations')}
                    diagnosticsOf={store.diagnosticsUnder('sublocations')}
                    dataField="sublocations"
                />
            </StructureContext.Provider>
            <FormMaybeCodeTextInput
                label={_('Map id')}
                optional
                value={draft.mapId}
                onChange={(next) => store.setField('mapId', next)}
                placeholder="global"
                diagnostics={store.exactDiagnostics('mapId')}
                dataField="mapId"
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
                suffix="Location"
            />
            <HintText size="small">
                {_('The location polygon is edited on the')}{' '}
                <a href={router.href({ page: 'map' })}>{_('Map page')}</a>.
            </HintText>
        </>
    )
);
