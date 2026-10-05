import type { TMaybeCode } from '@story/visualizer-protocol';
import { NumberInput } from '../NumberInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<number>, number> & {
    placeholder?: string;
    dataField?: string;
};

export const FormNumberInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: 0,
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <NumberInput {...inputProps} />}
        </FormLabel>
    );
};
