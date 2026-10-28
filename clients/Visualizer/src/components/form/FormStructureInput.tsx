import type { TInputProps } from '../inputs/inputTypes';
import { StructureInput } from '../inputs/StructureInput/StructureInput';
import type {
    TLiteralDraft,
    TStructureRow,
} from '../inputs/StructureInput/structureRows';
import { FormLabel } from './FormLabel';
import { splitFormProps, type TFormInputProps } from './formProps';

type TProps = TFormInputProps<readonly TStructureRow[], TStructureRow[]> &
    Pick<TInputProps<unknown>, 'dataField'> & {
        literals?: TLiteralDraft;
    };

export const FormStructureInput = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: [],
        ...props,
    });
    return (
        <FormLabel {...labelProps}>
            {inputProps && <StructureInput {...inputProps} />}
        </FormLabel>
    );
};
