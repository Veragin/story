import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';

export const ActionRow = styled('div')`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: ${spacingCss(1)};
`;
