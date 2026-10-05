import type { TMaybeCode } from '@story/visualizer-protocol';
import { BooleanInput } from '../BooleanInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<boolean>, boolean>;

export const FormBooleanInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: false,
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <BooleanInput {...inputProps} />}
        </FormLabel>
    );
};
