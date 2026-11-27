import type { ReactNode } from 'react';
import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

type TProps = {
    start?: ReactNode;
    end?: ReactNode;
};

export const SidebarToolbar = ({ start, end }: TProps) => (
    <SToolbar role="toolbar">
        {start}
        <SGap />
        {end}
    </SToolbar>
);

const SToolbar = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.25)};
    margin: ${spacingCss(-0.5)} ${spacingCss(-0.5)} 0;
`;

const SGap = styled('span')`
    flex: 1;
`;
