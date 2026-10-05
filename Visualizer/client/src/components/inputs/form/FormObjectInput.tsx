import type {
    TFieldDesc,
    TMaybeCode,
    TValueRecord,
} from '@story/visualizer-protocol';
import type { TDiagnosticsOf } from '../inputTypes';
import { ObjectInput } from '../ObjectInput/ObjectInput';
import { ObjectViewToggle } from '../ObjectInput/ObjectViewToggle';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<TValueRecord>> & {
    fields?: readonly TFieldDesc[];
    allowCustomFields?: boolean;
    diagnosticsOf?: TDiagnosticsOf;
    dataField?: string;
    hideViewToggle?: boolean;
};

export const FormObjectInput = ({
    actions,
    hideViewToggle,
    ...props
}: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: {},
        ...props,
    });
    return (
        <FormLabel
            {...labelProps}
            actions={
                <>
                    {actions}
                    {inputProps && !hideViewToggle && (
                        <ObjectViewToggle {...inputProps} />
                    )}
                </>
            }
        >
            {inputProps && <ObjectInput {...inputProps} hideViewToggle />}
        </FormLabel>
    );
};
