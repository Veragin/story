import { capitalize } from '@story/shared';
import { observer } from 'mobx-react-lite';
import type { TDataTypeDto, TEntityDto } from '@story/protocol';
import { DataTypeSection } from '../Structure/DataTypeSection';
import type { EntityFormStore } from './EntityFormStore';

type TProps = {
    store: EntityFormStore;
    entity: TEntityDto;
    dataType: TDataTypeDto | undefined;
    suffix: 'Character' | 'Npc' | 'Location';
};

export const DataTypeField = observer(
    ({ store, entity, dataType, suffix }: TProps) => (
        <DataTypeSection
            value={dataType}
            onChange={(next) => store.setField('dataType', next)}
            newName={`T${capitalize(entity.id)}${suffix}Data`}
            file={entity.file}
            diagnostics={store.fieldDiagnostics('dataType')}
            dataField="dataType"
        />
    )
);
