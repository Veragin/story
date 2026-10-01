import styled from '@emotion/styled';
import { TextField } from '@mui/material';

type TSourceFieldProps = {
    label: string;
    value: string;
    onChange: (code: string) => void;
    readOnly?: boolean;
};

export const SourceField = ({
    label,
    value,
    onChange,
    readOnly,
}: TSourceFieldProps) => (
    <SCode
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{ input: { readOnly } }}
        size="small"
        fullWidth
        multiline
        minRows={1}
        maxRows={12}
    />
);

const SCode = styled(TextField)`
    & textarea {
        font-family: monospace;
        font-size: 13px;
    }
`;
