import type { TFunctionDto } from '@story/visualizer-protocol';
import { FunctionInput } from '../FunctionInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TFunctionDto> & {
    emptyCode?: string;
    placeholder?: string;
    dataField?: string;
};

export const FormFunctionInput = ({ emptyCode = '', ...props }: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: { code: emptyCode },
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <FunctionInput {...inputProps} />}
        </FormLabel>
    );
};
