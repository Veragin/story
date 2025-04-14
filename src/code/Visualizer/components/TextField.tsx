import styled from '@emotion/styled';
import { TextField as MuiTextField } from '@mui/material';

export const TextField = styled(MuiTextField)`
    & *,
    & *:hover,
    & *:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline {
        color: white;
        border-color: white;
    }
`;
