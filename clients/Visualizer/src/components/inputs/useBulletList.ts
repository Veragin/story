import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { bulletListEdit, type TTextSelection } from './bulletList';

type TPendingSelection = {
    input: HTMLTextAreaElement;
    edit: TTextSelection;
};

export const useBulletList = (onChange: (value: string) => void) => {
    const pending = useRef<TPendingSelection | null>(null);

    useLayoutEffect(() => {
        const current = pending.current;
        if (!current || current.input.value !== current.edit.value) return;
        current.input.setSelectionRange(current.edit.selectionStart, current.edit.selectionEnd);
        pending.current = null;
    });

    return (e: KeyboardEvent) => {
        const input = e.target;
        if (e.defaultPrevented || e.nativeEvent.isComposing) return;
        if (!(input instanceof HTMLTextAreaElement) || input.readOnly) return;
        const edit = bulletListEdit(
            {
                value: input.value,
                selectionStart: input.selectionStart,
                selectionEnd: input.selectionEnd,
            },
            e
        );
        if (!edit) return;
        e.preventDefault();
        if (edit.value === input.value) return;
        pending.current = { input, edit };
        onChange(edit.value);
    };
};
