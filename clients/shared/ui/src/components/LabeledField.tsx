import type { ReactNode } from 'react';
import { styled, Typography } from '@mui/material';
import { spacingCss } from './css';

type TProps = {
    label: string;
    actions?: ReactNode;
    helperText?: string;
    helperActions?: ReactNode;
    warning?: string;
    error?: string | null;
    invalid?: boolean;
    children?: ReactNode;
};

export const LabeledField = ({
    label,
    actions,
    helperText,
    helperActions,
    warning,
    error,
    invalid,
    children,
}: TProps) => (
    <SRoot data-form-field={label}>
        <SGrid>
            <SHeader>
                <Typography
                    variant="caption"
                    color={
                        invalid || error
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
            </SHeader>
            <SBody>
                {children}
                {warning && (
                    <Typography variant="caption" color="warning.main">
                        {warning}
                    </Typography>
                )}
                {(error || helperText || helperActions) && (
                    <SHelperRow>
                        {error ? (
                            <Typography variant="caption" color="error">
                                {error}
                            </Typography>
                        ) : (
                            helperText && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {helperText}
                                </Typography>
                            )
                        )}
                        {helperActions && (
                            <SHelperActions>{helperActions}</SHelperActions>
                        )}
                    </SHelperRow>
                )}
            </SBody>
        </SGrid>
    </SRoot>
);

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

const SHelperRow = styled('div')`
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
`;

// keeps the icon button from growing the caption line
const SHelperActions = styled('span')`
    display: flex;
    margin-block: -6px;
    margin-left: auto;
`;

const SSpacer = styled('span')`
    flex: 1;
`;
