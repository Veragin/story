import { observer } from 'mobx-react-lite';
import {
    isValueRecord,
    typeDefault,
    type TTypeRef,
    type TValue,
} from '@story/protocol';
import { FormField } from '../form/FormField';
import { splitFormProps, type TFormInputProps } from '../form/formProps';
import type { TDiagnosticsOf } from '../inputs/inputTypes';
import { useTypeContext } from '../../structure/structureContext';
import { toMaybeCode } from '../../values/valueSource';
import { useViewToggle } from './ObjectEditor/useViewToggle';
import { ValueEditor } from './ValueEditor';

type TProps = TFormInputProps<TValue> & {
    type: TTypeRef;
    diagnosticsOf?: TDiagnosticsOf;
};

export const FormValueEditor = observer(({ actions, ...props }: TProps) => {
    const context = useTypeContext();
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: typeDefault(props.type, context),
        ...props,
    });
    const view = useViewToggle(
        actions,
        inputProps && props.type.t === 'object'
            ? {
                  ...inputProps,
                  value: toMaybeCode(inputProps.value, isValueRecord),
              }
            : null
    );
    return (
        <FormField {...labelProps} actions={view.actions}>
            {inputProps && (
                <ValueEditor
                    {...inputProps}
                    hideViewToggle={view.hideViewToggle}
                />
            )}
        </FormField>
    );
});
