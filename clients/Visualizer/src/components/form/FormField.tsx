import type { ReactNode } from 'react';
import { styled, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LabeledField } from '@story/ui';
import { AddButton } from '../buttons/AddButton';
import { TooltipIconButton } from '../buttons/TooltipIconButton';
import { FieldDiagnostics } from './FieldDiagnostics';
import { isInvalid, type TFormProps } from './formProps';

type TProps = TFormProps & {
    isSet?: boolean;
    onAdd?: () => void;
    onRemove?: () => void;
    disabled?: boolean;
    children?: ReactNode;
};

export const FormField = ({
    label,
    diagnostics = [],
    optional,
    addTooltip,
    actions,
    helperText,
    helperActions,
    warning,
    error,
    isSet = true,
    onAdd,
    onRemove,
    disabled,
    children,
}: TProps) => {
    if (optional && !isSet) {
        const addButton = (
            <AddButton
                label={label}
                tone="inherit"
                disabled={disabled || !onAdd}
                data-action="add-field"
                onClick={onAdd}
            />
        );
        return (
            <SAddRow data-form-field={label}>
                {addTooltip ? (
                    <Tooltip title={addTooltip} describeChild>
                        <span>{addButton}</span>
                    </Tooltip>
                ) : (
                    addButton
                )}
                <FieldDiagnostics diagnostics={diagnostics} />
            </SAddRow>
        );
    }

    return (
        <LabeledField
            label={label}
            helperText={helperText}
            helperActions={helperActions}
            warning={warning}
            error={error}
            invalid={isInvalid({ diagnostics, error })}
            actions={
                <>
                    {actions}
                    {optional && onRemove && (
                        <TooltipIconButton
                            title={_('Remove %s', label)}
                            icon={CloseIcon}
                            disabled={disabled}
                            data-action="remove-field"
                            onClick={onRemove}
                        />
                    )}
                </>
            }
        >
            {children}
            <FieldDiagnostics diagnostics={diagnostics} />
        </LabeledField>
    );
};

const SAddRow = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;
