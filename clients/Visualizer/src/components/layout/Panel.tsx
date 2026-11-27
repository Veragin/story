import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { SectionTitle } from './SectionTitle';

type TProps = {
    'title': string;
    'info'?: ReactNode;
    'actions'?: ReactNode;
    'footer'?: ReactNode;
    'children': ReactNode;
    'data-testid'?: string;
};

export const Panel = ({
    title,
    info,
    actions,
    footer,
    children,
    'data-testid': testId,
}: TProps) => (
    <SPanel role="region" aria-label={title} data-testid={testId}>
        <SHeader>
            <SectionTitle>{title}</SectionTitle>
            <SInfo>{info}</SInfo>
            {actions}
        </SHeader>
        <SBody>{children}</SBody>
        {footer && <SFooter>{footer}</SFooter>}
    </SPanel>
);

const SPanel = styled('section')(({ theme }) => ({
    position: 'absolute',
    top: theme.spacing(1.5),
    right: theme.spacing(1.5),
    zIndex: 3,
    display: 'flex',
    flexDirection: 'column',
    width: 260,
    maxHeight: `calc(100% - ${theme.spacing(3)})`,
    color: theme.palette.text.primary,
    fontSize: theme.typography.small.fontSize,
    backgroundColor: theme.palette.surface.overlay,
    border: `1px solid ${theme.palette.border.strong}`,
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
}));

const SHeader = styled('div')`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: ${spacingCss(1)};
    min-height: 40px;
    padding: 0 ${spacingCss(0.5)} 0 ${spacingCss(1.5)};
    border-bottom: 1px solid ${({ theme }) => theme.palette.border.subtle};
`;

const SInfo = styled('span')`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
`;

const SBody = styled('div')`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
`;

const SFooter = styled('div')`
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(1.25)} ${spacingCss(1.5)};
    border-top: 1px solid ${({ theme }) => theme.palette.border.subtle};
`;
