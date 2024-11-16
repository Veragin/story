import { styled } from '@mui/material';
import { Row } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';

export const Nav = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: center;
    padding: 0 ${spacingCss(2)};

    & > span:first-of-type {
        flex: 1;
    }
`;
