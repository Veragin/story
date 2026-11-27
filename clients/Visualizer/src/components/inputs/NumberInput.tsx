import { useEffect, useState } from 'react';
import { TextField } from '@mui/material';
import { INPUT_DEFAULTS } from './inputDefaults';
import { inputSlotProps } from './inputSlotProps';
import type { TInputProps } from './inputTypes';

const textToNumber = (text: string): number | undefined => {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

type TProps = TInputProps<number> & {
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
    const [text, setText] = useState(String(value));
    useEffect(() => {
        if (textToNumber(text) !== value) setText(String(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only an outside change resets the text
    }, [value]);

    const partial = textToNumber(text) === undefined;
    return (
        <TextField
            {...INPUT_DEFAULTS}
            value={text}
            error={hasError || partial}
            disabled={disabled}
            placeholder={placeholder}
            slotProps={inputSlotProps(
                { ariaLabel, dataField },
                { 'aria-invalid': hasError || partial, 'inputMode': 'decimal' }
            )}
            onChange={(e) => {
                setText(e.target.value);
                const n = textToNumber(e.target.value);
                if (n !== undefined) onChange(n);
            }}
            onBlur={() => setText(String(value))}
        />
    );
};
