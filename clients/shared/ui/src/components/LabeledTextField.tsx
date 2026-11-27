import type { ComponentProps } from 'react';
import { TextField, type TextFieldProps } from '@mui/material';
import { LabeledField } from './LabeledField';

type TProps = Omit<ComponentProps<typeof LabeledField>, 'children'> &
    Omit<TextFieldProps, 'label' | 'error' | 'helperText' | 'variant'> & {
        dataField?: string;
    };

export const LabeledTextField = ({
    label,
    actions,
    helperText,
    warning,
    error,
    invalid,
    dataField,
    slotProps,
    ...props
}: TProps) => (
    <LabeledField
        label={label}
        actions={actions}
        helperText={helperText}
        warning={warning}
        error={error}
        invalid={invalid}
    >
        <TextField
            size="small"
            fullWidth
            {...props}
            error={!!error || !!invalid}
            slotProps={{
                ...slotProps,
                htmlInput: {
                    'aria-label': label,
                    'data-field': dataField,
                    ...slotProps?.htmlInput,
                },
            }}
        />
    </LabeledField>
);
