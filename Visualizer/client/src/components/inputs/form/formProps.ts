import type { ReactNode } from 'react';
import type { TDiagnosticDto } from '@story/visualizer-protocol';

export type TFormProps = {
    label: string;
    diagnostics?: TDiagnosticDto[];
    optional?: boolean;
    actions?: ReactNode;
    helperText?: string;
    warning?: string;
};

export type TFormInputProps<V, C extends V = V> = TFormProps & {
    value: V | undefined;
    onChange: (value: C | undefined) => void;
    disabled?: boolean;
};

export const splitFormProps = <V, C extends V, R extends object>({
    label,
    diagnostics = [],
    optional,
    actions,
    helperText,
    warning,
    value,
    onChange,
    disabled,
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
                  hasError: diagnostics.length > 0,
                  ariaLabel: label,
                  disabled,
              },
});
