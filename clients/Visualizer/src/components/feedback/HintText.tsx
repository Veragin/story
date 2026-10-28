import { styled } from '@mui/material';

type THintSize = 'meta' | 'small';

export const HintText = styled('div', {
    shouldForwardProp: (prop) => prop !== 'size',
})<{ size?: THintSize }>`
    font-size: ${({ theme, size = 'meta' }) => theme.typography[size].fontSize};
    color: ${({ theme }) => theme.palette.text.secondary};
    & code {
        color: ${({ theme }) => theme.palette.text.primary};
    }
    & a {
        color: ${({ theme }) => theme.palette.primary.main};
    }
`;
