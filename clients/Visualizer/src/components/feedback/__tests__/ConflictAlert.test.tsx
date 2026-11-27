import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $$, click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { ConflictAlert } from '../ConflictAlert';

const buttons = () => $$('[data-notice="conflict"] button').map((b) => b.textContent);

describe('ConflictAlert', () => {
    afterEach(unmount);

    it('offers Reload and Keep mine when the file changed', () => {
        const onReload = vi.fn();
        const onKeepMine = vi.fn(() => Promise.resolve(true));
        mount(<ConflictAlert onReload={onReload} onKeepMine={onKeepMine} />);
        expect(get('[data-notice="conflict"]').textContent).toContain('Changed on disk');
        expect(buttons()).toEqual(['Reload', 'Keep mine']);

        click('[data-notice="conflict"] button:first-of-type');
        click('[data-notice="conflict"] button:last-of-type');
        expect(onReload).toHaveBeenCalledOnce();
        expect(onKeepMine).toHaveBeenCalledOnce();
    });

    it('names the deleted entry and offers Discard mine / Re-create', () => {
        mount(<ConflictAlert deleted what="literal" onReload={vi.fn()} onKeepMine={vi.fn()} />);
        const text = get('[data-notice="conflict"]').textContent;
        expect(text).toContain('Deleted on disk');
        expect(text).toContain('This literal was deleted');
        expect(buttons()).toEqual(['Discard mine', 'Re-create']);
    });

    it('shows only the actions it is given and disables them while busy', () => {
        mount(<ConflictAlert onReload={vi.fn()} disabled action={<button>Close</button>} />);
        expect(buttons()).toEqual(['Reload', 'Close']);
        expect(get<HTMLButtonElement>('[data-notice="conflict"] button').disabled).toBe(true);
    });
});
