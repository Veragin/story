import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { Column, Row, spacingCss } from '@story/ui';

type Props = {
    title: string;
    info?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
};

export const ToolWindow = ({ title, info, actions, children }: Props) => (
    <SWindow role="region" aria-label={title} data-testid="map-tool-window">
        <SHeader>
            <STitle>{title}</STitle>
            <SInfo>{info}</SInfo>
            {actions}
        </SHeader>
        {children}
    </SWindow>
);

const SWindow = styled(Column)`
    position: absolute;
    top: ${spacingCss(1.5)};
    right: ${spacingCss(1.5)};
    z-index: 3;
    width: 260px;
    max-height: calc(100% - ${spacingCss(3)});
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #666 transparent;
    border: 1px solid #444;
    border-radius: 8px;
    background-color: rgba(17, 17, 17, 0.92);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 13px;
`;

const SHeader = styled(Row)`
    flex-shrink: 0;
    align-items: center;
    gap: ${spacingCss(1)};
    min-height: 40px;
    padding: 0 ${spacingCss(0.5)} 0 ${spacingCss(1.5)};
    border-bottom: 1px solid #333;
`;

const STitle = styled.span`
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
`;

const SInfo = styled.span`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    opacity: 0.7;
`;
