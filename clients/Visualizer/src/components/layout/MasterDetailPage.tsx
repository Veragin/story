import type { ReactNode } from 'react';
import { styled } from '@mui/material';

type TProps = {
    list: ReactNode;
    header?: ReactNode;
    children: ReactNode;
};

export const MasterDetailPage = ({ list, header, children }: TProps) => (
    <SPage>
        {header}
        <SBody>
            {list}
            <SDetail>{children}</SDetail>
        </SBody>
    </SPage>
);

const SPage = styled('div')`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    color: ${({ theme }) => theme.palette.text.primary};
    background: ${({ theme }) => theme.palette.background.default};
`;

const SBody = styled('div')`
    display: flex;
    flex: 1;
    min-height: 0;
`;

const SDetail = styled('div')`
    flex: 1;
    min-width: 0;
    overflow: auto;
`;
