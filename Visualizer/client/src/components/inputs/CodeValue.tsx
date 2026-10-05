import { Button, styled, Tooltip } from '@mui/material';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { spacingCss } from '@story/ui';

type TProps<T> = {
    code: string;
    parse: (code: string) => T | undefined;
    onChange: (value: T) => void;
    fallback?: T;
    convertLabel?: string;
    hasError?: boolean;
    disabled?: boolean;
    ariaLabel: string;
};

export const CodeValue = <T,>({
    code,
    parse,
    onChange,
    fallback,
    convertLabel = _('Convert to value'),
    hasError,
    disabled,
    ariaLabel,
}: TProps<T>) => {
    const parsed = parse(code);
    return (
        <SCodeBlock data-error={hasError ? 'true' : undefined}>
            <SCode aria-label={ariaLabel} data-code-value>
                {code}
            </SCode>
            {parsed !== undefined ? (
                <Tooltip
                    title={_('The value is code. Convert it to edit it here.')}
                >
                    <span>
                        <Button
                            size="small"
                            color="inherit"
                            startIcon={<TextFieldsIcon fontSize="small" />}
                            disabled={disabled}
                            data-action="convert-to-value"
                            onClick={() => onChange(parsed)}
                        >
                            {convertLabel}
                        </Button>
                    </span>
                </Tooltip>
            ) : (
                fallback !== undefined && (
                    <Tooltip
                        title={_(
                            'The code is not a plain value. Reset it to edit it here.'
                        )}
                    >
                        <span>
                            <Button
                                size="small"
                                color="inherit"
                                startIcon={<RestartAltIcon fontSize="small" />}
                                disabled={disabled}
                                data-action="reset-value"
                                onClick={() => onChange(fallback)}
                            >
                                {_('Reset')}
                            </Button>
                        </span>
                    </Tooltip>
                )
            )}
        </SCodeBlock>
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
