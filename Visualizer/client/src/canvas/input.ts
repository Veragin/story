/**
 * True when keyboard input should go to a form control rather than to a canvas shortcut:
 * the event target (or the focused element) is an input, textarea, select or contenteditable.
 */
export function isTypingTarget(target: EventTarget | null = document.activeElement): boolean {
    const candidates = [target, typeof document !== 'undefined' ? document.activeElement : null];
    for (const el of candidates) {
        if (!el || !(el instanceof HTMLElement)) continue;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') return true;
    }
    return false;
}
