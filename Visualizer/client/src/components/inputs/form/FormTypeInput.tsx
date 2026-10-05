import type { TMaybeCode } from '@story/visualizer-protocol';
import type { TOption } from '../inputTypes';
import { TypeInput } from '../TypeInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<string>, string> & {
    options: readonly TOption[];
    placeholder?: string;
    dataField?: string;
};

export const FormTypeInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: props.options[0]?.id ?? '',
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <TypeInput {...inputProps} />}
        </FormLabel>
    );
};
