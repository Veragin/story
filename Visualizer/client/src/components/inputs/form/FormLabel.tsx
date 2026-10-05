import type { ReactNode } from 'react';
import { Button, IconButton, styled, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { spacingCss } from '@story/ui';
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
    isSet = true,
    onAdd,
    onRemove,
    disabled,
    children,
}: TProps) => {
    const hasError = diagnostics.length > 0;

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
        <SRoot data-form-field={label}>
            <SGrid>
                <SHeader>
                    <Typography
                        variant="caption"
                        color={
                            hasError
                                ? 'error'
                                : warning
                                  ? 'warning.main'
                                  : 'text.secondary'
                        }
                    >
                        {label}
                    </Typography>
                    <SSpacer />
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
                </SHeader>
                <SBody>
                    {children}
                    {warning && (
                        <Typography variant="caption" color="warning.main">
                            {warning}
                        </Typography>
                    )}
                    {helperText && (
                        <Typography variant="caption" color="text.secondary">
                            {helperText}
                        </Typography>
                    )}
                    <InputDiagnostics diagnostics={diagnostics} />
                </SBody>
            </SGrid>
        </SRoot>
    );
};

const SRoot = styled('div')`
    container-type: inline-size;
    width: 100%;
    min-width: 0;
`;

const SGrid = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 2px;

    @container (min-width: 560px) {
        display: grid;
        grid-template-columns: 160px minmax(0, 1fr);
        column-gap: ${spacingCss(1)};
        align-items: start;
    }
`;

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;

    @container (min-width: 560px) {
        min-height: 40px;
        overflow-wrap: anywhere;
    }
`;

const SBody = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;

const SAddRow = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;

const SSpacer = styled('span')`
    flex: 1;
`;
