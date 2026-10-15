import { Button, styled, TextField, Tooltip } from '@mui/material';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import {
    isCode,
    type TDiagnosticDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { spacingCss } from '@story/ui';
import { FieldDiagnostics } from './CodeField';
import { codeToText } from './codeLiterals';
import { FieldLabel } from './FieldLabel';
import { SField } from './fieldLayout';

type TInputProps = {
    value: TMaybeCode<string> | undefined;
    onChange: (value: string) => void;
    multiline?: boolean;
    placeholder?: string;
    hasError?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    dataField?: string;
};

export const PlainTextInput = ({
    value,
    onChange,
    multiline,
    placeholder,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TInputProps) =>
    isCode(value) ? (
        <SCodeBlock data-error={hasError ? 'true' : undefined}>
            <SCode aria-label={ariaLabel}>{value.code}</SCode>
            <Tooltip
                title={_(
                    'The value is code. Convert it to plain text to edit it here.'
                )}
            >
                <span>
                    <Button
                        size="small"
                        color="inherit"
                        startIcon={<TextFieldsIcon fontSize="small" />}
                        disabled={disabled}
                        data-action="convert-to-text"
                        onClick={() => onChange(codeToText(value.code))}
                    >
                        {_('Convert to text')}
                    </Button>
                </span>
            </Tooltip>
        </SCodeBlock>
    ) : (
        <TextField
            size="small"
            fullWidth
            multiline={multiline}
            minRows={multiline ? 2 : undefined}
            value={value ?? ''}
            error={hasError}
            disabled={disabled}
            placeholder={placeholder}
            slotProps={{
                htmlInput: { 'aria-label': ariaLabel, 'data-field': dataField },
            }}
            onChange={(e) => onChange(e.target.value)}
        />
    );

type TFieldProps = Omit<TInputProps, 'hasError' | 'ariaLabel'> & {
    label: string;
    diagnostics?: TDiagnosticDto[];
};

export const PlainTextField = ({
    label,
    diagnostics = [],
    ...props
}: TFieldProps) => {
    const hasError = diagnostics.length > 0;
    return (
        <SField>
            <FieldLabel hasError={hasError}>{label}</FieldLabel>
            <PlainTextInput {...props} hasError={hasError} ariaLabel={label} />
            <FieldDiagnostics diagnostics={diagnostics} />
        </SField>
    );
};

const SCodeBlock = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    &[data-error='true'] > pre {
        border-color: ${({ theme }) => theme.palette.error.main};
    }
`;

const SCode = styled('pre')`
    margin: 0;
    width: 100%;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.45;
    padding: ${spacingCss(1)};
    color: #e6e6e6;
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 4px;
`;
