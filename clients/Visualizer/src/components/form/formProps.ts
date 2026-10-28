import type { ReactNode } from 'react';
import type { TDiagnosticDto } from '@story/protocol';

export type TFormProps = {
    label: string;
    diagnostics?: readonly TDiagnosticDto[];
    optional?: boolean;
    actions?: ReactNode;
    helperText?: string;
    warning?: string;
    error?: string | null;
};

export type TFormInputProps<V, C = V> = TFormProps & {
    value: V | undefined;
    onChange: (value: C | undefined) => void;
    disabled?: boolean;
    dataField?: string;
};

export const isInvalid = ({ diagnostics = [], error }: Pick<TFormProps, 'diagnostics' | 'error'>) =>
    diagnostics.length > 0 || !!error;

export const splitFormProps = <V, C extends V, R extends object>({
    label,
    diagnostics = [],
    optional,
    actions,
    helperText,
    warning,
    error,
    value,
    onChange,
    disabled,
    dataField,
    emptyValue,
    ...rest
}: TFormInputProps<V, C> & R & { emptyValue: NoInfer<C> }) => ({
    labelProps: {
        label,
        diagnostics,
        optional,
        actions,
        helperText,
        warning,
        error,
        disabled,
        isSet: value !== undefined,
        onAdd: () => onChange(emptyValue),
        onRemove: () => onChange(undefined),
    },
    inputProps:
        value === undefined && optional
            ? null
            : {
                  ...rest,
                  value: value ?? emptyValue,
                  onChange: (next: C) => onChange(next),
                  hasError: isInvalid({ diagnostics, error }),
                  ariaLabel: label,
                  disabled,
                  dataField,
              },
});
