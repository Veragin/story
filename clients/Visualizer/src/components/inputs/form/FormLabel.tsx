import type { ReactNode } from 'react';
import { Button, IconButton, styled, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { LabeledField } from '@story/ui';
import { InputDiagnostics } from '../InputDiagnostics';
import type { TFormProps } from './formProps';

type TProps = TFormProps & {
    isSet?: boolean;
    onAdd?: () => void;
    onRemove?: () => void;
    disabled?: boolean;
    children?: ReactNode;
};

export const FormLabel = ({
    label,
    diagnostics = [],
    optional,
    actions,
    helperText,
    warning,
    error,
    isSet = true,
    onAdd,
    onRemove,
    disabled,
    children,
}: TProps) => {
    if (optional && !isSet) {
        return (
            <SAddRow data-form-field={label}>
                <Button
                    size="small"
                    color="inherit"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={disabled || !onAdd}
                    data-action="add-field"
                    onClick={onAdd}
                >
                    {label}
                </Button>
                <InputDiagnostics diagnostics={diagnostics} />
            </SAddRow>
        );
    }

    return (
        <LabeledField
            label={label}
            helperText={helperText}
            warning={warning}
            error={error}
            invalid={diagnostics.length > 0}
            actions={
                <>
                    {actions}
                    {optional && onRemove && (
                        <Tooltip title={_('Remove %s', label)}>
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={onRemove}
                                    disabled={disabled}
                                    aria-label={_('Remove %s', label)}
                                    data-action="remove-field"
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                </>
            }
        >
            {children}
            <InputDiagnostics diagnostics={diagnostics} />
        </LabeledField>
    );
};

const SAddRow = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;
