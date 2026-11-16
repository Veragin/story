import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

type TProps = {
    'label': string;
    'children': ReactNode;
    'className'?: string;
    'data-testid'?: string;
};

export const Sidebar = ({
    label,
    children,
    className,
    'data-testid': testId,
}: TProps) => (
    <SSidebar
        role="region"
        aria-label={label}
        className={className}
        data-testid={testId}
    >
        {children}
    </SSidebar>
);

const SSidebar = styled('section')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.25)};
    min-height: 100%;
    padding: ${spacingCss(1.5)};
    box-sizing: border-box;
`;
