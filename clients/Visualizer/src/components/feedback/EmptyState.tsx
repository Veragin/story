import type { ReactNode } from 'react';
import { styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';

type TProps = {
    message: string;
    action?: ReactNode;
};

export const EmptyState = ({ message, action }: TProps) => (
    <SEmpty>
        <Typography variant="body2" color="text.secondary">
            {message}
        </Typography>
        {action}
    </SEmpty>
);

const SEmpty = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(2)};
    text-align: center;
`;
