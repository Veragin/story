import { useRef, type KeyboardEvent } from 'react';
import { styled } from '@mui/material';

type TProps = {
    value: string;
    onChange: (code: string) => void;
    hasError?: boolean;
    disabled?: boolean;
    minRows?: number;
    ariaLabel?: string;
    dataField?: string;
};

export const CodeTextArea = ({
    value,
    onChange,
    hasError,
    disabled,
    minRows = 1,
    ariaLabel,
    dataField,
}: TProps) => {
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
            aria-label={ariaLabel}
            data-field={dataField}
            disabled={disabled}
            rows={Math.max(minRows, value.split('\n').length)}
            data-error={hasError ? 'true' : undefined}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
        />
    );
};

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
