import type { TInputProps } from '../inputs/inputTypes';
import { StructureEditor } from './StructureEditor/StructureEditor';
import type {
    TLiteralDraft,
    TStructureRow,
} from '../../structure/structureRows';
import { FormField } from '../form/FormField';
import { splitFormProps, type TFormInputProps } from '../form/formProps';

type TProps = TFormInputProps<readonly TStructureRow[], TStructureRow[]> &
    Pick<TInputProps<unknown>, 'dataField'> & {
        literals?: TLiteralDraft;
    };

export const FormStructureEditor = (props: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: [],
        ...props,
    });
    return (
        <FormField {...labelProps}>
            {inputProps && <StructureEditor {...inputProps} />}
        </FormField>
    );
};
