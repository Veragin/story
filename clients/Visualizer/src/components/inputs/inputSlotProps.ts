import type { InputBaseComponentProps } from '@mui/material';
import type { TInputProps } from './inputTypes';

type TSlotSource = Pick<TInputProps<unknown>, 'ariaLabel' | 'dataField'>;

export const inputSlotProps = ({ ariaLabel, dataField }: TSlotSource, htmlInput: InputBaseComponentProps = {}) => ({
    htmlInput: {
        ...htmlInput,
        'aria-label': ariaLabel,
        'data-field': dataField,
    },
});
