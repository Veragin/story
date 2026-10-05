import type { TMaybeCode } from '@story/visualizer-protocol';
import { StringInput } from '../StringInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<string>, string> & {
    multiline?: boolean;
    placeholder?: string;
    dataField?: string;
};

export const FormStringInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: '',
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <StringInput {...inputProps} />}
        </FormLabel>
    );
};
