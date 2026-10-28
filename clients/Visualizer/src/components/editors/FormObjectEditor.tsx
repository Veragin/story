import type { TFieldDesc, TMaybeCode, TValueRecord } from '@story/protocol';
import { FormField } from '../form/FormField';
import { splitFormProps, type TFormInputProps } from '../form/formProps';
import type { TDiagnosticsOf } from '../inputs/inputTypes';
import { ObjectEditor } from './ObjectEditor/ObjectEditor';
import { useViewToggle } from './ObjectEditor/useViewToggle';

type TProps = TFormInputProps<TMaybeCode<TValueRecord>> & {
    fields?: readonly TFieldDesc[];
    allowCustomFields?: boolean;
    diagnosticsOf?: TDiagnosticsOf;
};

export const FormObjectEditor = ({ actions, ...props }: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: {},
        ...props,
    });
    const view = useViewToggle(actions, inputProps);
    return (
        <FormField {...labelProps} actions={view.actions}>
            {inputProps && (
                <ObjectEditor
                    {...inputProps}
                    hideViewToggle={view.hideViewToggle}
                />
            )}
        </FormField>
    );
};
