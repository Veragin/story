import { useEffect, useState } from 'react';
import { TextField } from '@mui/material';
import { isCode, type TMaybeCode } from '@story/visualizer-protocol';
import { CodeValue } from './CodeValue';
import type { TInputProps } from './inputTypes';
import { isNumber, parseAs } from './valueSource';

const parseNumber = parseAs(isNumber);

const textToNumber = (text: string): number | undefined => {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

type TProps = TInputProps<TMaybeCode<number>, number> & {
    placeholder?: string;
};

export const NumberInput = ({
    value,
    onChange,
    placeholder,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const numeric = isCode(value) ? null : value;
    const [text, setText] = useState(numeric === null ? '' : String(numeric));
    useEffect(() => {
        if (numeric !== null && textToNumber(text) !== numeric)
            setText(String(numeric));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only an outside change resets the text
    }, [numeric]);

    if (isCode(value)) {
        return (
            <CodeValue
                code={value.code}
                parse={parseNumber}
                fallback={0}
                onChange={onChange}
                hasError={hasError}
                disabled={disabled}
                ariaLabel={ariaLabel}
            />
        );
    }

    const partial = textToNumber(text) === undefined;
    return (
        <TextField
            size="small"
            value={text}
            error={hasError || partial}
            disabled={disabled}
            placeholder={placeholder}
            slotProps={{
                htmlInput: {
                    'aria-label': ariaLabel,
                    'aria-invalid': hasError || partial,
                    'data-field': dataField,
                    'inputMode': 'decimal',
                },
            }}
            onChange={(e) => {
                setText(e.target.value);
                const n = textToNumber(e.target.value);
                if (n !== undefined) onChange(n);
            }}
            onBlur={() => setText(String(value))}
            sx={{ maxWidth: 180 }}
        />
    );
};
