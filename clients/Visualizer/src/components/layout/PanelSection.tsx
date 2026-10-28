import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

type TProps = {
    label?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
};

export const PanelSection = ({ label, actions, children }: TProps) => (
    <SSection>
        {(label || actions) && (
            <SLabelRow>
                <SLabel>{label}</SLabel>
                {actions}
            </SLabelRow>
        )}
        {children}
    </SSection>
);

const SSection = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(1.25)} ${spacingCss(1.5)};
    &:not(:last-of-type) {
        border-bottom: 1px solid ${({ theme }) => theme.palette.border.subtle};
    }
`;

const SLabelRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
    min-height: 28px;
    margin-right: ${spacingCss(-0.75)};
`;

const SLabel = styled('span')`
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;
