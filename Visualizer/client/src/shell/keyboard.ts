import { useEffect, useRef } from 'react';
import { modals } from './modals';

/**
 * Global keyboard shortcuts. One `keydown` listener on `window`, attached while at least one
 * handler is registered.
 *
 *   const off = keyboard.on('Delete', () => deleteSelected());
 *   const off = keyboard.on(['ctrl+z', 'meta+z'], undo);
 *   useKey('Escape', () => store.clearSelection());
 *
 * Key specs: an `event.key` value (`'Delete'`, `'Escape'`, `'ArrowLeft'`, `'w'`, `'+'`; single
 * letters match case-insensitively), optionally prefixed with modifiers `ctrl+`, `alt+`,
 * `shift+`, `meta+`, `mod+` (ctrl or meta). Without a modifier prefix the handler only fires when
 * ctrl/alt/meta are NOT held (shift is ignored for plain keys so `'+'` and `'?'` work).
 *
 * Events are ignored while an input, textarea, select or contenteditable element is focused,
 * and while a modal is open, unless the handler opts in (`allowInInputs` / `allowInModal`).
 *
 * Handlers run newest first. A handler that returns `true` consumes the event: later (older)
 * handlers are skipped and `preventDefault()` is called.
 */

export type TKeyHandler = (event: KeyboardEvent) => boolean | void;

export type TKeyOptions = {
    allowInInputs?: boolean;
    allowInModal?: boolean;
};

type TParsedKey = {
    key: string;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
    mod: boolean;
    hasModifier: boolean;
};

type TEntry = {
    keys: TParsedKey[];
    handler: TKeyHandler;
    options: TKeyOptions;
};

const parseKey = (spec: string): TParsedKey => {
    // split on '+' but keep a trailing '+' as the key itself ('ctrl++', '+')
    const parts = spec === '+' ? ['+'] : spec.split(/\+(?!$)/);
    const key = parts.pop() ?? '';
    const mods = new Set(parts.map((p) => p.toLowerCase()));
    return {
        key: key.length === 1 ? key.toLowerCase() : key,
        ctrl: mods.has('ctrl'),
        alt: mods.has('alt'),
        shift: mods.has('shift'),
        meta: mods.has('meta'),
        mod: mods.has('mod'),
        hasModifier: mods.size > 0,
    };
};

const matches = (k: TParsedKey, e: KeyboardEvent): boolean => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key !== k.key) return false;
    if (!k.hasModifier) return !e.ctrlKey && !e.altKey && !e.metaKey;
    if (k.mod ? !(e.ctrlKey || e.metaKey) : e.ctrlKey !== k.ctrl) return false;
    if (!k.mod && e.metaKey !== k.meta) return false;
    return e.altKey === k.alt && e.shiftKey === k.shift;
};

/** True for elements where typing should not trigger shortcuts. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

class Keyboard {
    private entries: TEntry[] = [];
    private attached = false;

    /** Register a handler. Returns the function that unregisters it. */
    on = (key: string | string[], handler: TKeyHandler, options: TKeyOptions = {}): (() => void) => {
        const entry: TEntry = {
            keys: (Array.isArray(key) ? key : [key]).map(parseKey),
            handler,
            options,
        };
        this.entries.push(entry);
        this.attach();
        return () => this.off(entry);
    };

    private off = (entry: TEntry) => {
        this.entries = this.entries.filter((e) => e !== entry);
        if (this.entries.length === 0) this.detach();
    };

    private attach = () => {
        if (this.attached || typeof window === 'undefined') return;
        window.addEventListener('keydown', this.onKeyDown);
        this.attached = true;
    };

    private detach = () => {
        if (!this.attached) return;
        window.removeEventListener('keydown', this.onKeyDown);
        this.attached = false;
    };

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.defaultPrevented || e.isComposing) return;
        const inInput = isEditableTarget(e.target) || isEditableTarget(document.activeElement);
        const inModal = modals.isOpen;

        // newest first; copy so handlers may unregister themselves
        for (const entry of [...this.entries].reverse()) {
            if (inInput && !entry.options.allowInInputs) continue;
            if (inModal && !entry.options.allowInModal) continue;
            if (!entry.keys.some((k) => matches(k, e))) continue;
            if (entry.handler(e) === true) {
                e.preventDefault();
                return;
            }
        }
    };
}

export const keyboard = new Keyboard();

/**
 * Hook form of `keyboard.on`. The latest `handler` is always called, so it does not need to be
 * memoised. Re-registers only when the key spec or options change.
 */
export const useKey = (
    key: string | string[],
    handler: TKeyHandler,
    options: TKeyOptions & { enabled?: boolean } = {}
) => {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    const keySpec = Array.isArray(key) ? key.join('\u0000') : key;
    const { enabled = true, allowInInputs, allowInModal } = options;

    useEffect(() => {
        if (!enabled) return;
        return keyboard.on(keySpec.split('\u0000'), (e) => handlerRef.current(e), {
            allowInInputs,
            allowInModal,
        });
    }, [keySpec, enabled, allowInInputs, allowInModal]);
};
