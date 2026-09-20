import styled from '@emotion/styled';
import {
    FormControl,
    InputLabel,
    MenuItem,
    Select as MuiSelect,
    SelectProps,
} from '@mui/material';
import { useState } from 'react';

type Props = Omit<SelectProps, 'onChange'> & {
    options: { value: string; label: string }[];
    onChange: (s: string) => void;
};

export const Select = ({
    options,
    value,
    onChange,
    label,
    ...props
}: Props) => {
    const [val, setVal] = useState(value);
    return (
        <FormControl fullWidth>
            <InputLabel>{label}</InputLabel>
            <SSelect
                {...props}
                value={val}
                onChange={(e) => {
                    setVal(e.target.value);
                    onChange(e.target.value as string);
                }}
            >
                {options.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                        {option.label}
                    </MenuItem>
                ))}
            </SSelect>
        </FormControl>
    );
};

const SSelect = styled(MuiSelect)`
    color: white;
    border-color: white;
    & *,
    & *:hover,
    &:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline,
    & .MuiFormLabel-root,
    & .MuiOutlinedInput-notchedOutline,
    & .MuiInputLabel-root,
    & .MuiInputBase-root {
        color: white;
        border-color: white;
    }
`;
