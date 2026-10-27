import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { Column, Row, spacingCss } from '@story/ui';

type Props = {
    label?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
};

export const ToolSection = ({ label, actions, children }: Props) => (
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

const SSection = styled(Column)`
    gap: ${spacingCss(1)};
    padding: ${spacingCss(1.25)} ${spacingCss(1.5)};
    &:not(:last-of-type) {
        border-bottom: 1px solid #333;
    }
`;

const SLabelRow = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1)};
    min-height: 28px;
    margin-right: ${spacingCss(-0.75)};
`;

const SLabel = styled.span`
    display: flex;
    flex: 1;
    align-items: center;
    min-width: 0;
    font-size: 12px;
    opacity: 0.7;
`;
