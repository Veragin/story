import type { ReactNode } from 'react';
import { Typography } from '@mui/material';

type TProps = {
    hasError: boolean;
    children: ReactNode;
};

export const FieldLabel = ({ hasError, children }: TProps) => (
    <Typography variant="caption" color={hasError ? 'error' : 'text.secondary'}>
        {children}
    </Typography>
);
