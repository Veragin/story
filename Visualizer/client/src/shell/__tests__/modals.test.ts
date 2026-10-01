import { describe, expect, it, vi } from 'vitest';
import { ModalStore } from '../modals';

describe('ModalStore', () => {
    it('open returns an idempotent close and calls onClose once', () => {
        const store = new ModalStore();
        const onClose = vi.fn();
        const close = store.open(() => null, { onClose });
        expect(store.isOpen).toBe(true);
        close();
        close();
        expect(store.isOpen).toBe(false);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('confirm resolves false when closed without an answer', async () => {
        const store = new ModalStore();
        const answer = store.confirm({ title: 'Sure?' });
        store.closeAll();
        await expect(answer).resolves.toBe(false);
    });
});
