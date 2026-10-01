import { ReactNode, useRef } from 'react';
import { IconButton, styled, Tooltip } from '@mui/material';
import { Code, TextFields } from '@mui/icons-material';
import { spacingCss } from '@story/ui';
import {
    isCode,
    type TCode,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { parseLiteral, valueToSource } from './entityFields';

type TCodeAreaProps = {
    'value': string;
    'onChange': (value: string) => void;
    'placeholder'?: string;
    'error'?: boolean;
    'aria-label'?: string;
};

const CodeArea = ({
    value,
    onChange,
    placeholder,
    error,
    ...rest
}: TCodeAreaProps) => {
    const rows = Math.max(1, value.split('\n').length);
    return (
        <STextarea
            {...rest}
            spellCheck={false}
            value={value}
            rows={Math.min(rows, 24)}
            placeholder={placeholder}
            data-error={error ? 'true' : undefined}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key !== 'Tab' || e.shiftKey) return;
                e.preventDefault();
                const el = e.currentTarget;
                const { selectionStart: start, selectionEnd: end } = el;
                const next = value.slice(0, start) + '    ' + value.slice(end);
                onChange(next);
                requestAnimationFrame(() =>
                    el.setSelectionRange(start + 4, start + 4)
                );
            }}
        />
    );
};

type TMaybeCodeFieldProps<T> = {
    label: string;
    value: TMaybeCode<T> | undefined;
    onChange: (value: TMaybeCode<T>) => void;
    accept: (value: unknown) => value is T;
    fallback: T;
    renderLiteral: (value: T, onChange: (value: T) => void) => ReactNode;
    errors?: string[];
    actions?: ReactNode;
    block?: boolean;
};

export const MaybeCodeField = <T,>({
    label,
    value,
    onChange,
    accept,
    fallback,
    renderLiteral,
    errors = [],
    actions,
    block,
}: TMaybeCodeFieldProps<T>) => {
    const remembered = useRef<{ code: string; literal: T } | null>(null);
    const asCode: TCode | null = isCode(value)
        ? value
        : value === undefined || accept(value)
          ? null
          : { code: valueToSource(value as never) };
    const literal = asCode
        ? null
        : value === undefined
          ? fallback
          : (value as T);

    const backToLiteral = (): T | undefined => {
        if (!asCode) return undefined;
        if (remembered.current && remembered.current.code === asCode.code)
            return remembered.current.literal;
        const parsed = parseLiteral(asCode.code);
        return accept(parsed) ? parsed : undefined;
    };
    const back = asCode ? backToLiteral() : undefined;

    const toggle = () => {
        if (asCode) {
            if (back !== undefined) onChange(back);
            return;
        }
        const code = valueToSource(literal as never);
        remembered.current = { code, literal: literal as T };
        onChange({ code });
    };

    return (
        <SField>
            <SLabelRow>
                <SLabel>{label}</SLabel>
                <Tooltip
                    title={
                        asCode
                            ? back === undefined
                                ? _('Not a plain value; edit it as code')
                                : _('Edit as value')
                            : _('Edit as code')
                    }
                >
                    <span>
                        <IconButton
                            size="small"
                            onClick={toggle}
                            disabled={!!asCode && back === undefined}
                            aria-label={
                                asCode ? _('Edit as value') : _('Edit as code')
                            }
                            color={asCode ? 'primary' : 'default'}
                        >
                            {asCode ? (
                                <TextFields fontSize="inherit" />
                            ) : (
                                <Code fontSize="inherit" />
                            )}
                        </IconButton>
                    </span>
                </Tooltip>
                {actions}
            </SLabelRow>
            <SBody data-block={block ? 'true' : undefined}>
                {asCode ? (
                    <CodeArea
                        aria-label={label}
                        value={asCode.code}
                        error={errors.length > 0}
                        onChange={(code) => onChange({ code })}
                    />
                ) : (
                    renderLiteral(literal as T, (v) => onChange(v))
                )}
            </SBody>
            <FieldErrors errors={errors} />
        </SField>
    );
};

export const CodeOnlyField = ({
    label,
    value,
    onChange,
    errors = [],
    actions,
    placeholder,
}: {
    label: ReactNode;
    value: string;
    onChange: (value: string) => void;
    errors?: string[];
    actions?: ReactNode;
    placeholder?: string;
}) => (
    <SField>
        <SLabelRow>
            <SLabel>{label}</SLabel>
            {actions}
        </SLabelRow>
        <CodeArea
            aria-label={typeof label === 'string' ? label : undefined}
            value={value}
            onChange={onChange}
            error={errors.length > 0}
            placeholder={placeholder}
        />
        <FieldErrors errors={errors} />
    </SField>
);

const FieldErrors = ({ errors }: { errors: string[] }) =>
    errors.length === 0 ? null : (
        <SErrors>
            {errors.map((e, i) => (
                <div key={i}>{e}</div>
            ))}
        </SErrors>
    );

const STextarea = styled('textarea')`
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.45;
    tab-size: 4;
    padding: ${spacingCss(1)};
    color: #e6e6e6;
    background: #111;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 4px;
    outline: none;
    &:focus {
        border-color: ${({ theme }) => theme.palette.primary.main};
    }
    &[data-error='true'] {
        border-color: ${({ theme }) => theme.palette.error.main};
    }
`;

export const SField = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    min-width: 0;
`;

export const SLabelRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(0.5)};
    min-height: 28px;
`;

export const SLabel = styled('div')`
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
`;

const SBody = styled('div')`
    min-width: 0;
    &[data-block='true'] {
        padding-left: ${spacingCss(1)};
        border-left: 2px solid rgba(255, 255, 255, 0.12);
    }
`;

const SErrors = styled('div')`
    color: ${({ theme }) => theme.palette.error.light};
    font-size: 12px;
    white-space: pre-wrap;
`;
