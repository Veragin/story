import styled from '@emotion/styled';
import { TextField as MuiTextField } from '@mui/material';

export const TextField = styled(MuiTextField)`
    color: white;
    border-color: white;
    & *,
    & *:hover,
    & *:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline,
    & .MuiInputLabel-root,
    & .MuiInputBase-root {
        color: white;
        border-color: white;
    }
`;
