import { observer } from 'mobx-react-lite';
import {
    isValueRecord,
    typeDefault,
    type TTypeRef,
    type TValue,
} from '@story/protocol';
import type { TDiagnosticsOf } from '../inputs/inputTypes';
import { ObjectViewToggle } from '../inputs/ObjectInput/ObjectViewToggle';
import { useTypeContext } from '../inputs/structureContext';
import { toMaybeCode } from '../inputs/valueSource';
import { ValueInput } from '../inputs/ValueInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TValue> & {
    type: TTypeRef;
    diagnosticsOf?: TDiagnosticsOf;
    dataField?: string;
};

export const FormValueInput = observer(({ actions, ...props }: TProps) => {
    const context = useTypeContext();
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: typeDefault(props.type, context),
        ...props,
    });
    const objectToggle = inputProps && props.type.t === 'object' && (
        <ObjectViewToggle
            value={toMaybeCode(inputProps.value, isValueRecord)}
            onChange={inputProps.onChange}
            disabled={inputProps.disabled}
            ariaLabel={inputProps.ariaLabel}
        />
    );
    return (
        <FormLabel
            {...labelProps}
            actions={
                <>
                    {actions}
                    {objectToggle}
                </>
            }
        >
            {inputProps && <ValueInput {...inputProps} hideViewToggle />}
        </FormLabel>
    );
});
