import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { styled } from '@mui/material';
import type { TInputProps } from '../inputs/inputTypes';

type TProps = TInputProps<string> & {
    minRows?: number;
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
    useLayoutEffect(() => fitHeight(ref.current), [value]);
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        let width = el.clientWidth;
        const observer = new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fitHeight(el);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
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

const fitHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
};

const STextArea = styled('textarea')`
    width: 100%;
    box-sizing: border-box;
    resize: none;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid ${({ theme }) => theme.palette.border.strong};
    background: ${({ theme }) => theme.palette.surface.code};
    color: ${({ theme }) => theme.palette.text.code};
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    line-height: 1.45;
    tab-size: 4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: hidden;

    &:focus {
        outline: none;
        border-color: ${({ theme }) => theme.palette.primary.main};
    }

    &[data-error='true'] {
        border-color: ${({ theme }) => theme.palette.error.main};
    }
`;
