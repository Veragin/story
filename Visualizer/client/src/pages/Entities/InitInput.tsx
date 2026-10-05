import { observer } from 'mobx-react-lite';
import type {
    TDataTypeDto,
    TMaybeCode,
    TValueRecord,
} from '@story/visualizer-protocol';
import { FormObjectInput } from '../../components/inputs/form/FormObjectInput';
import type { StructureStore } from '../../stores/StructureStore';
import type { EntityFormStore } from './EntityFormStore';

type TProps = {
    store: EntityFormStore;
    structure: StructureStore;
    baseType: string | null;
    dataType: TDataTypeDto | undefined;
    value: TMaybeCode<TValueRecord>;
};

export const InitInput = observer(
    ({ store, structure, baseType, dataType, value }: TProps) => {
        // without a known structure the keys are free, typed by their values
        const known = structure.loaded && (!dataType || !!dataType.fields);
        return (
            <FormObjectInput
                label="init"
                value={value}
                onChange={(next) => store.setField('init', next ?? {})}
                fields={
                    known ? structure.fieldsOf(baseType, dataType) : undefined
                }
                allowCustomFields={!known}
                diagnostics={store.exactDiagnostics('init')}
                diagnosticsOf={store.diagnosticsUnder('init')}
                dataField="init"
            />
        );
    }
);
