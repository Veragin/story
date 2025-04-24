import styled from '@emotion/styled';
import { TextField as MuiTextField, TextFieldProps } from '@mui/material';

export const TextField = (props: TextFieldProps) => {
    return <SField {...props} onKeyDown={(e) => e.stopPropagation()} />;
};

const SField = styled(MuiTextField)`
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
