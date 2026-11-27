import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $$, click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { DialogButtons } from '../DialogButtons';

const buttons = () => $$<HTMLButtonElement>('button');

describe('DialogButtons', () => {
    afterEach(unmount);

    it('renders Cancel then a contained primary button', () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        mount(
            <DialogButtons
                label="Save"
                onClose={onClose}
                onConfirm={onConfirm}
            />
        );
        const [cancel, primary] = buttons();
        expect(cancel.textContent).toBe('Cancel');
        expect(cancel.classList.contains('MuiButton-colorInherit')).toBe(true);
        expect(primary.textContent).toBe('Save');
        expect(primary.classList.contains('MuiButton-contained')).toBe(true);
        expect(primary.classList.contains('MuiButton-colorPrimary')).toBe(true);
        expect(primary.type).toBe('button');

        click('button:first-of-type');
        expect(onClose).toHaveBeenCalledOnce();
        click('button:last-of-type');
        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('uses the error colour and focuses the primary when dangerous', () => {
        mount(<DialogButtons danger label="Delete" onClose={() => {}} />);
        const primary = buttons()[1];
        expect(primary.classList.contains('MuiButton-colorError')).toBe(true);
        expect(document.activeElement).toBe(primary);
    });

    it('disables the primary and shows the busy label while busy', () => {
        mount(
            <DialogButtons
                busy
                label="Create"
                busyLabel="Creating…"
                onClose={() => {}}
            />
        );
        const primary = buttons()[1];
        expect(primary.disabled).toBe(true);
        expect(primary.textContent).toBe('Creating…');
    });

    it('makes the primary a submit button', () => {
        mount(<DialogButtons submit label="Create" onClose={() => {}} />);
        expect(
            get<HTMLButtonElement>('button[type="submit"]').textContent
        ).toBe('Create');
    });

    it('renders a single Close button in closeOnly mode', () => {
        const onClose = vi.fn();
        mount(<DialogButtons closeOnly onClose={onClose} />);
        expect(buttons().map((b) => b.textContent)).toEqual(['Close']);
        click('button');
        expect(onClose).toHaveBeenCalledOnce();
    });
});
