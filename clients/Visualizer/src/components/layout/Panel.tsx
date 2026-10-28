import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { SectionTitle } from './SectionTitle';

type TPanelVariant = 'floating' | 'sidebar';

type TProps = {
    'title': string;
    'info'?: ReactNode;
    'actions'?: ReactNode;
    'footer'?: ReactNode;
    'variant'?: TPanelVariant;
    'children': ReactNode;
    'data-testid'?: string;
};

export const Panel = ({
    title,
    info,
    actions,
    footer,
    variant = 'floating',
    children,
    'data-testid': testId,
}: TProps) => (
    <SPanel
        role="region"
        aria-label={title}
        data-testid={testId}
        variant={variant}
    >
        <SHeader>
            {variant === 'sidebar' ? (
                <SSidebarTitle>{title}</SSidebarTitle>
            ) : (
                <SectionTitle>{title}</SectionTitle>
            )}
            <SInfo>{info}</SInfo>
            {actions}
        </SHeader>
        <SBody>{children}</SBody>
        {footer && <SFooter>{footer}</SFooter>}
    </SPanel>
);

const SPanel = styled('section', {
    shouldForwardProp: (prop) => prop !== 'variant',
})<{ variant: TPanelVariant }>(({ theme, variant }) => ({
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    color: theme.palette.text.primary,
    fontSize: theme.typography.small.fontSize,
    backgroundColor: theme.palette.surface.overlay,
    ...(variant === 'floating'
        ? {
              top: theme.spacing(1.5),
              right: theme.spacing(1.5),
              zIndex: 3,
              width: 260,
              maxHeight: `calc(100% - ${theme.spacing(3)})`,
              border: `1px solid ${theme.palette.border.strong}`,
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          }
        : {
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 4,
              width: 'min(340px, 90vw)',
              borderLeft: `1px solid ${theme.palette.border.strong}`,
          }),
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

const SSidebarTitle = styled('h2')`
    margin: 0;
    font-size: ${({ theme }) => theme.typography.subtitle1.fontSize};
    font-weight: 600;
    word-break: break-word;
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
