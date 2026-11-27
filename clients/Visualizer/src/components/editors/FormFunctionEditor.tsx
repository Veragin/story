import type { TFunctionDto } from '@story/protocol';
import { FunctionEditor } from './FunctionEditor';
import { FormField } from '../form/FormField';
import { splitFormProps, type TFormInputProps } from '../form/formProps';

type TProps = TFormInputProps<TFunctionDto> & {
    emptyCode?: string;
    placeholder?: string;
};

export const FormFunctionEditor = ({ emptyCode = '', ...props }: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: { code: emptyCode },
        ...props,
    });
    return (
        <FormField {...labelProps}>
            {inputProps && <FunctionEditor {...inputProps} />}
        </FormField>
    );
};
