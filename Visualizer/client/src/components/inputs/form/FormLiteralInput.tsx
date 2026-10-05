import type { TMaybeCode } from '@story/visualizer-protocol';
import { LiteralInput } from '../LiteralInput';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<TMaybeCode<string>, string> & {
    options: readonly string[];
    onCreateOption?: (value: string) => Promise<boolean>;
    placeholder?: string;
    dataField?: string;
};

export const FormLiteralInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: props.options[0] ?? '',
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <LiteralInput {...inputProps} />}
        </FormLabel>
    );
};
