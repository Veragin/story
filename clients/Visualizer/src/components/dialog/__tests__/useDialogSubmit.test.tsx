import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDialogSubmit } from '../useDialogSubmit';

(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type TResult = ReturnType<typeof useDialogSubmit>;

let root: Root | null = null;

const renderHook = (
    action: () => Promise<void>,
    canSubmit = true
): { current: TResult } => {
    const ref: { current: TResult | null } = { current: null };
    const Probe = () => {
        ref.current = useDialogSubmit(action, { canSubmit });
        return null;
    };
    const created = createRoot(document.createElement('div'));
    root = created;
    act(() => created.render(<Probe />));
    return {
        get current() {
            if (!ref.current) throw new Error('hook not rendered');
            return ref.current;
        },
    };
};

describe('useDialogSubmit', () => {
    afterEach(() => {
        act(() => root?.unmount());
        root = null;
    });

    it('is busy while the action runs and idle after', async () => {
        let finish = () => {};
        const action = vi.fn(
            () => new Promise<void>((resolve) => (finish = resolve))
        );
        const hook = renderHook(action);
        let pending: Promise<void> = Promise.resolve();
        act(() => {
            pending = hook.current.submit();
        });
        expect(hook.current.busy).toBe(true);
        expect(hook.current.touched).toBe(true);
        await act(async () => {
            finish();
            await pending;
        });
        expect(hook.current.busy).toBe(false);
        expect(hook.current.error).toBeNull();
        expect(action).toHaveBeenCalledOnce();
    });

    it('turns a thrown error into its message', async () => {
        const hook = renderHook(() => Promise.reject(new Error('Boom')));
        await act(() => hook.current.submit());
        expect(hook.current.error).toBe('Boom');
        expect(hook.current.busy).toBe(false);
    });

    it('only marks touched when it cannot submit', async () => {
        const action = vi.fn(() => Promise.resolve());
        const hook = renderHook(action, false);
        await act(() => hook.current.submit());
        expect(action).not.toHaveBeenCalled();
        expect(hook.current.touched).toBe(true);
    });
});
