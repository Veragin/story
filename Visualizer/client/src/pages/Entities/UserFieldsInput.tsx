import { observer } from 'mobx-react-lite';
import type { TValue, TValueRecord } from '@story/visualizer-protocol';
import { FormValueInput } from '../../components/inputs/form/FormValueInput';
import type { StructureStore } from '../../stores/StructureStore';
import type { EntityFormStore } from './EntityFormStore';

type TProps = {
    store: EntityFormStore;
    structure: StructureStore;
    typeName: string;
    values: TValueRecord | undefined;
};

const withoutKey = (record: TValueRecord, key: string): TValueRecord =>
    Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

export const UserFieldsInput = observer(
    ({ store, structure, typeName, values = {} }: TProps) => {
        const set = (key: string) => (next: TValue | undefined) =>
            store.setField(
                'userFields',
                next === undefined
                    ? withoutKey(values, key)
                    : { ...values, [key]: next }
            );
        return (
            <>
                {structure.userFieldsOf(typeName).map((field) => (
                    <FormValueInput
                        key={field.key}
                        label={field.key}
                        type={field.type}
                        value={values[field.key]}
                        onChange={set(field.key)}
                        optional={field.optional}
                        helperText={field.description}
                        diagnostics={store.exactDiagnostics(field.key)}
                        diagnosticsOf={store.diagnosticsUnder(field.key)}
                        dataField={field.key}
                    />
                ))}
            </>
        );
    }
);
