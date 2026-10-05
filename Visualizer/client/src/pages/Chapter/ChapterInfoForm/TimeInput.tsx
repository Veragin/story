import { TextField } from '@mui/material';
import { isCode, type TMaybeCode } from '@story/visualizer-protocol';
import { CodeValue } from '../../../components/inputs/CodeValue';
import type { TInputProps } from '../../../components/inputs/inputTypes';

const TIME_RE = /^Time\.fromString\(\s*(['"])(.*)\1\s*\)$/;
const parseTime = (code: string) => TIME_RE.exec(code.trim())?.[2];

export const TimeInput = ({
    value,
    onChange,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TInputProps<TMaybeCode<string>, string>) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={parseTime}
            fallback=""
            onChange={onChange}
            hasError={hasError}
            disabled={disabled}
            ariaLabel={ariaLabel}
        />
    ) : (
        <TextField
            size="small"
            fullWidth
            value={value}
            error={hasError}
            disabled={disabled}
            placeholder="2.1. 8:00"
            slotProps={{
                htmlInput: { 'aria-label': ariaLabel, 'data-field': dataField },
            }}
            onChange={(e) => onChange(e.target.value)}
        />
    );
