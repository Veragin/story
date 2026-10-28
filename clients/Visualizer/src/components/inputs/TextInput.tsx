import type { ReactNode } from 'react';
import { InputAdornment, TextField } from '@mui/material';
import { INPUT_DEFAULTS } from './inputDefaults';
import { inputSlotProps } from './inputSlotProps';
import type { TInputProps } from './inputTypes';

type TProps = TInputProps<string> & {
    multiline?: boolean;
    minRows?: number;
    placeholder?: string;
    type?: 'text' | 'password';
    startAdornment?: ReactNode;
    autoFocus?: boolean;
    maxLength?: number;
    spellCheck?: boolean;
    autoComplete?: string;
    readOnly?: boolean;
    onEnter?: () => void;
    onEscape?: () => void;
    onBlur?: () => void;
};

export const TextInput = ({
    value,
    onChange,
    multiline,
    minRows = 2,
    placeholder,
    type = 'text',
    startAdornment,
    autoFocus,
    maxLength,
    spellCheck,
    autoComplete,
    readOnly,
    onEnter,
    onEscape,
    onBlur,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => (
    <TextField
        {...INPUT_DEFAULTS}
        type={type}
        multiline={multiline}
        minRows={multiline ? minRows : undefined}
        value={value}
        error={hasError}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        slotProps={{
            ...inputSlotProps(
                { ariaLabel, dataField },
                { maxLength, spellCheck }
            ),
            input: {
                readOnly,
                startAdornment: startAdornment ? (
                    <InputAdornment position="start">
                        {startAdornment}
                    </InputAdornment>
                ) : undefined,
            },
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
            if (onEscape && e.key === 'Escape') {
                // the field consumes Escape, so an enclosing dialog or page shortcut stays put
                e.stopPropagation();
                onEscape();
                return;
            }
            if (!onEnter || e.key !== 'Enter' || multiline) return;
            e.preventDefault();
            onEnter();
        }}
        onBlur={onBlur}
    />
);
