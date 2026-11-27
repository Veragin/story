import { DescriptionInput } from '../inputs/DescriptionInput';
import { FormField } from './FormField';

type TProps = {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
    dataField?: string;
};

export const FormDescriptionInput = ({
    label = _('Description'),
    ...inputProps
}: TProps) => (
    <FormField label={label}>
        <DescriptionInput {...inputProps} />
    </FormField>
);
