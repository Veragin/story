import { styled } from '@mui/material';

export const SectionTitle = styled('span')`
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.palette.text.secondary};
`;
