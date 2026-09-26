import { ReactNode } from 'react';
import { styled } from '@mui/material';
import { Column, spacingCss } from '@story/ui';

/** Fills the page area under the top bar. Use as the root of a page. */
export const PageContainer = styled(Column)`
    width: 100%;
    height: 100%;
    min-height: 0;
    align-items: stretch;
    overflow: hidden;
    position: relative;
    background-color: #000;
`;

/** Centered "coming soon" text for pages a later WP fills in. */
export const PagePlaceholder = ({
    title,
    children,
}: {
    title: string;
    children?: ReactNode;
}) => (
    <PageContainer>
        <SPlaceholder>
            <h2>{title}</h2>
            {children}
        </SPlaceholder>
    </PageContainer>
);

const SPlaceholder = styled(Column)`
    margin: auto;
    align-items: center;
    gap: ${spacingCss(1)};
    color: white;
    opacity: 0.7;
`;
