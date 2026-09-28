// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyboard } from '../keyboard';
import { modals } from '../modals';

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = window) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

describe('keyboard', () => {
    const offs: (() => void)[] = [];
    afterEach(() => {
        offs.splice(0).forEach((off) => off());
        modals.closeAll();
        document.body.innerHTML = '';
    });

    it('calls a handler for its key and stops after unregistering', () => {
        const fn = vi.fn();
        const off = keyboard.on('Delete', fn);
        press('Delete');
        off();
        press('Delete');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('matches letters case-insensitively and respects modifiers', () => {
        const plain = vi.fn();
        const ctrl = vi.fn();
        offs.push(keyboard.on('w', plain), keyboard.on('ctrl+s', ctrl));
        press('W', { shiftKey: true });
        press('w', { ctrlKey: true });
        press('s', { ctrlKey: true });
        press('s');
        expect(plain).toHaveBeenCalledTimes(1);
        expect(ctrl).toHaveBeenCalledTimes(1);
    });

    it('ignores key presses in inputs unless allowed', () => {
        const fn = vi.fn();
        const allowed = vi.fn();
        offs.push(keyboard.on('Delete', fn), keyboard.on('Delete', allowed, { allowInInputs: true }));
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        press('Delete', {}, input);
        expect(fn).not.toHaveBeenCalled();
        expect(allowed).toHaveBeenCalledTimes(1);
    });

    it('ignores key presses while a modal is open unless allowed', () => {
        const fn = vi.fn();
        offs.push(keyboard.on('Delete', fn));
        const close = modals.open(() => null);
        press('Delete');
        close();
        press('Delete');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('runs newest first and stops when a handler returns true', () => {
        const older = vi.fn();
        offs.push(keyboard.on('Escape', older));
        offs.push(keyboard.on('Escape', () => true));
        const event = press('Escape');
        expect(older).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(true);
    });
});
