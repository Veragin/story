import {
    ReactNode,
    useRef,
    type HTMLAttributes,
    type Key,
    type KeyboardEvent,
} from 'react';
import {
    Autocomplete,
    Button,
    IconButton,
    MenuItem,
    styled,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import {
    isCode,
    type TDiagnosticDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { parseStringLiteral, quoteString } from './codeLiterals';

/**
 * Editors for the code-field convention of the protocol (plan §3): a field typed `T | TCode`
 * is edited either as a literal (a text box, a number, a picker…) or as a raw TypeScript
 * snippet in a monospace textarea, and a toggle switches between the two. Fields that are
 * always code (`onFinish`) have no toggle.
 *
 *     <StringCodeField label={_('Title')} value={p.title} onChange={(title) => edit({ title })} />
 *     <CodeField label="onFinish" value={link.onFinish} onChange={…} optional emptyCode="() => {}" />
 *
 * Switching literal → code writes the literal as TS source (`toCode`); code → literal reads it
 * back with `fromCode` when the snippet is a plain literal, else falls back to `emptyLiteral`.
 */

export type TCodeFieldProps<T> = {
    label: string;
    value: TMaybeCode<T> | undefined;
    onChange: (value: TMaybeCode<T> | undefined) => void;
    /** Renders the literal editor. Without it the field is code only. */
    literal?: (
        value: T,
        onChange: (value: T) => void,
        hasError: boolean
    ) => ReactNode;
    /** Literal used when switching to literal mode and the code is not a plain literal, or when adding. */
    emptyLiteral?: T;
    toCode?: (value: T) => string;
    fromCode?: (code: string) => T | undefined;
    /** The field may be absent: shows "+ label" when it is, and a remove button when it is not. */
    optional?: boolean;
    /** With `optional`: whether a present value may be removed again. Default true. */
    removable?: boolean;
    /** Code used when a code-only field is added. */
    emptyCode?: string;
    diagnostics?: TDiagnosticDto[];
    helperText?: string;
    disabled?: boolean;
};

export const CodeField = <T,>({
    label,
    value,
    onChange,
    literal,
    emptyLiteral,
    toCode = (v) => JSON.stringify(v),
    fromCode,
    optional,
    removable = true,
    emptyCode = '',
    diagnostics = [],
    helperText,
    disabled,
}: TCodeFieldProps<T>) => {
    const hasError = diagnostics.length > 0;

    if (value === undefined) {
        return (
            <SAddRow>
                <Button
                    size="small"
                    color="inherit"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={disabled}
                    onClick={() =>
                        onChange(
                            literal && emptyLiteral !== undefined
                                ? emptyLiteral
                                : { code: emptyCode }
                        )
                    }
                >
                    {label}
                </Button>
                <FieldDiagnostics diagnostics={diagnostics} />
            </SAddRow>
        );
    }

    const codeMode = isCode(value) || !literal;
    const toggle = () => {
        if (isCode(value)) {
            const parsed = fromCode?.(value.code);
            onChange(parsed !== undefined ? parsed : (emptyLiteral as T));
        } else {
            onChange({ code: toCode(value as T) });
        }
    };

    return (
        <SField>
            <SHeader>
                <Typography
                    variant="caption"
                    color={hasError ? 'error' : 'text.secondary'}
                >
                    {label}
                </Typography>
                <SSpacer />
                {literal && (
                    <Tooltip
                        title={
                            codeMode ? _('Edit as a value') : _('Edit as code')
                        }
                    >
                        <span>
                            <IconButton
                                size="small"
                                color={codeMode ? 'primary' : 'default'}
                                onClick={toggle}
                                disabled={
                                    disabled ||
                                    (isCode(value) &&
                                        emptyLiteral === undefined &&
                                        !fromCode)
                                }
                                aria-label={_('Toggle code')}
                            >
                                <CodeIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}
                {optional && removable && (
                    <Tooltip title={_('Remove %s', label)}>
                        <IconButton
                            size="small"
                            onClick={() => onChange(undefined)}
                            disabled={disabled}
                            aria-label={_('Remove')}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </SHeader>
            {codeMode ? (
                <CodeTextArea
                    value={isCode(value) ? value.code : ''}
                    onChange={(code) => onChange({ code })}
                    hasError={hasError}
                    disabled={disabled}
                />
            ) : (
                literal?.(value as T, (v) => onChange(v), hasError)
            )}
            {helperText && (
                <Typography variant="caption" color="text.secondary">
                    {helperText}
                </Typography>
            )}
            <FieldDiagnostics diagnostics={diagnostics} />
        </SField>
    );
};

/** Monospace textarea for TS snippets. Tab indents by four spaces. */
export const CodeTextArea = ({
    value,
    onChange,
    hasError,
    disabled,
    minRows = 1,
}: {
    value: string;
    onChange: (code: string) => void;
    hasError?: boolean;
    disabled?: boolean;
    minRows?: number;
}) => {
    const ref = useRef<HTMLTextAreaElement>(null);
    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
            return;
        e.preventDefault();
        const el = e.currentTarget;
        const { selectionStart: start, selectionEnd: end } = el;
        const next = `${value.slice(0, start)}    ${value.slice(end)}`;
        onChange(next);
        requestAnimationFrame(() =>
            ref.current?.setSelectionRange(start + 4, start + 4)
        );
    };
    return (
        <STextArea
            ref={ref}
            value={value}
            spellCheck={false}
            disabled={disabled}
            rows={Math.max(minRows, value.split('\n').length)}
            data-error={hasError ? 'true' : undefined}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
        />
    );
};

export const FieldDiagnostics = ({
    diagnostics,
}: {
    diagnostics: TDiagnosticDto[];
}) =>
    diagnostics.length === 0 ? null : (
        <SDiagnostics>
            {diagnostics.map((d, i) => (
                <li key={i}>
                    {d.message}
                    <SWhere>
                        {' '}
                        ({d.file}:{d.line}:{d.column})
                    </SWhere>
                </li>
            ))}
        </SDiagnostics>
    );

// ---- literal presets -----------------------------------------------------------------------------

const parseNumber = (code: string) => {
    const n = Number(code.trim());
    return code.trim() !== '' && Number.isFinite(n) ? n : undefined;
};

const parseBoolean = (code: string) =>
    code.trim() === 'true' ? true : code.trim() === 'false' ? false : undefined;

type TPresetProps<T> = Omit<
    TCodeFieldProps<T>,
    'literal' | 'toCode' | 'fromCode'
>;

export const StringCodeField = ({
    multiline,
    placeholder,
    ...props
}: TPresetProps<string> & { multiline?: boolean; placeholder?: string }) => (
    <CodeField<string>
        emptyLiteral=""
        {...props}
        toCode={quoteString}
        fromCode={parseStringLiteral}
        literal={(value, onChange, hasError) => (
            <TextField
                size="small"
                fullWidth
                value={value}
                error={hasError}
                multiline={multiline}
                minRows={multiline ? 2 : undefined}
                placeholder={placeholder}
                disabled={props.disabled}
                onChange={(e) => onChange(e.target.value)}
            />
        )}
    />
);

export const NumberCodeField = (props: TPresetProps<number>) => (
    <CodeField<number>
        emptyLiteral={0}
        {...props}
        toCode={String}
        fromCode={parseNumber}
        literal={(value, onChange, hasError) => (
            <TextField
                size="small"
                type="number"
                value={Number.isFinite(value) ? value : ''}
                error={hasError}
                disabled={props.disabled}
                onChange={(e) =>
                    onChange(e.target.value === '' ? 0 : Number(e.target.value))
                }
            />
        )}
    />
);

export const BooleanCodeField = (props: TPresetProps<boolean>) => (
    <CodeField<boolean>
        emptyLiteral={true}
        {...props}
        toCode={String}
        fromCode={parseBoolean}
        literal={(value, onChange, hasError) => (
            <TextField
                select
                size="small"
                value={value ? 'true' : 'false'}
                error={hasError}
                disabled={props.disabled}
                onChange={(e) => onChange(e.target.value === 'true')}
            >
                <MenuItem value="true">true</MenuItem>
                <MenuItem value="false">false</MenuItem>
            </TextField>
        )}
    />
);

export type TOption = { id: string; label?: string };

/** A string id (passage, location, chapter) picked from `options`, free text allowed. */
export const IdCodeField = ({
    options,
    placeholder,
    ...props
}: TPresetProps<string> & { options: TOption[]; placeholder?: string }) => (
    <CodeField<string>
        emptyLiteral=""
        {...props}
        toCode={quoteString}
        fromCode={parseStringLiteral}
        literal={(value, onChange, hasError) => (
            <Autocomplete
                freeSolo
                size="small"
                options={options.map((o) => o.id)}
                renderOption={(
                    liProps: HTMLAttributes<HTMLLIElement> & { key?: Key },
                    id
                ) => {
                    // MUI passes `key` inside the props; React wants it as its own attribute.
                    const props = { ...liProps };
                    delete props.key;
                    const o = options.find((x) => x.id === id);
                    return (
                        <li {...props} key={id}>
                            {o?.label && o.label !== id
                                ? `${id} — ${o.label}`
                                : id}
                        </li>
                    );
                }}
                value={value}
                disabled={props.disabled}
                onChange={(_e, v) => onChange(v ?? '')}
                onInputChange={(_e, v, reason) =>
                    reason === 'input' && onChange(v)
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        error={hasError}
                        placeholder={placeholder}
                    />
                )}
            />
        )}
    />
);

const SField = styled('div')`
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
`;

const SHeader = styled('div')`
    display: flex;
    align-items: center;
    min-height: 28px;
`;

const SAddRow = styled('div')`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;

const SSpacer = styled('span')`
    flex: 1;
`;

const STextArea = styled('textarea')`
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: #111;
    color: #e6db74;
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.45;
    tab-size: 4;
    white-space: pre;
    overflow-x: auto;

    &:focus {
        outline: none;
        border-color: #64b5f6;
    }

    &[data-error='true'] {
        border-color: #f44336;
    }
`;

const SDiagnostics = styled('ul')`
    margin: 2px 0 0;
    padding-left: 18px;
    color: #f44336;
    font-size: 12px;
`;

const SWhere = styled('span')`
    opacity: 0.7;
`;
