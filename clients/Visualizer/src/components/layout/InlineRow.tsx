import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

export const InlineRow = styled('div')`
    display: flex;
    align-items: flex-start;
    gap: ${spacingCss(1)};
    & > :first-child {
        flex: 1;
        min-width: 0;
    }
`;
