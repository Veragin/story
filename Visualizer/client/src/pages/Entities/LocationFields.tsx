import { styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { TLocationDto, TTypeRef } from '@story/visualizer-protocol';
import { FormArrayInput } from '../../components/inputs/form/FormArrayInput';
import { FormStringInput } from '../../components/inputs/form/FormStringInput';
import {
    StructureContext,
    withoutRefOption,
} from '../../components/inputs/structureContext';
import { router } from '../../shell';
import { LOCAL_CHARACTER_TYPE } from '../../typeRefs';
import { DataTypeInput } from './DataTypeInput';
import type { TEntityFieldsProps } from './entityFormProps';
import { ENTITY_TYPE_NAMES } from './entityFields';
import { InitInput } from './InitInput';
import { UserFieldsInput } from './UserFieldsInput';

const TYPES = ENTITY_TYPE_NAMES.locations;

const LOCATION_REF: TTypeRef = { t: 'ref', name: 'TLocation' };

export const LocationFields = observer(
    ({ store, structure, draft }: TEntityFieldsProps<TLocationDto>) => (
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
            <FormArrayInput
                label="localCharacters"
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
                <FormArrayInput
                    label="sublocations"
                    optional
                    itemType={LOCATION_REF}
                    value={draft.sublocations}
                    onChange={(next) => store.setField('sublocations', next)}
                    diagnostics={store.exactDiagnostics('sublocations')}
                    diagnosticsOf={store.diagnosticsUnder('sublocations')}
                    dataField="sublocations"
                />
            </StructureContext.Provider>
            <FormStringInput
                label="mapId"
                optional
                value={draft.mapId}
                onChange={(next) => store.setField('mapId', next)}
                placeholder="global"
                diagnostics={store.exactDiagnostics('mapId')}
                dataField="mapId"
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
                suffix="Location"
            />
            <SNote>
                {_('The location polygon is edited on the')}{' '}
                <a href={router.href({ page: 'map' })}>{_('Map page')}</a>.
            </SNote>
        </>
    )
);

const SNote = styled('div')`
    font-size: 13px;
    color: ${({ theme }) => theme.palette.text.secondary};
    & a {
        color: ${({ theme }) => theme.palette.primary.main};
    }
`;
