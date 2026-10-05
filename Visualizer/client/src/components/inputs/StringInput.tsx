import { TextField } from '@mui/material';
import { isCode, type TMaybeCode } from '@story/visualizer-protocol';
import { codeToText } from './codeLiterals';
import { CodeValue } from './CodeValue';
import type { TInputProps } from './inputTypes';

type TProps = TInputProps<TMaybeCode<string>, string> & {
    multiline?: boolean;
    placeholder?: string;
};

export const StringInput = ({
    value,
    onChange,
    multiline,
    placeholder,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={codeToText}
            convertLabel={_('Convert to text')}
            onChange={onChange}
            hasError={hasError}
            disabled={disabled}
            ariaLabel={ariaLabel}
        />
    ) : (
        <TextField
            size="small"
            fullWidth
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            value={value}
            error={hasError}
            disabled={disabled}
            placeholder={placeholder}
            slotProps={{
                htmlInput: { 'aria-label': ariaLabel, 'data-field': dataField },
            }}
            onChange={(e) => onChange(e.target.value)}
        />
    );
