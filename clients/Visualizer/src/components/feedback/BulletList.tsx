import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

export const BulletList = styled('ul')`
    margin: 0;
    padding-left: ${spacingCss(2)};
    & code {
        font-size: ${({ theme }) => theme.typography.meta.fontSize};
    }
`;
