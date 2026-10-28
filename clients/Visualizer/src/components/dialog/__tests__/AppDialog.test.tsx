import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { $, get, mount, unmount } from '../../inputs/__tests__/dom';
import { AppDialog } from '../AppDialog';
import { DialogButtons } from '../DialogButtons';

describe('AppDialog', () => {
    afterEach(unmount);

    it('submits the form on Enter in a field', () => {
        const onSubmit = vi.fn();
        mount(
            <AppDialog
                title="New thing"
                onClose={() => {}}
                onSubmit={onSubmit}
                actions={
                    <DialogButtons submit label="Create" onClose={() => {}} />
                }
            >
                <input aria-label="name" />
            </AppDialog>
        );
        const form = get<HTMLFormElement>('form');
        expect(form.contains(get('input[aria-label="name"]'))).toBe(true);
        expect(form.contains(get('button[type="submit"]'))).toBe(true);
        act(() => form.requestSubmit());
        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it('renders no form without onSubmit', () => {
        mount(<AppDialog title="Info" onClose={() => {}} />);
        expect($('form')).toBeNull();
        expect(get('.MuiDialogTitle-root').textContent).toBe('Info');
    });

    it('shows the error as an alert', () => {
        mount(
            <AppDialog title="T" onClose={() => {}} error={'Broken\nline'} />
        );
        const alert = get('.MuiAlert-standardError');
        expect(alert.textContent).toContain('Broken');
    });

    it('shows no alert without an error', () => {
        mount(<AppDialog title="T" onClose={() => {}} error={null} />);
        expect($('.MuiAlert-root')).toBeNull();
    });

    it('closes on Escape', () => {
        const onClose = vi.fn();
        mount(<AppDialog title="T" onClose={onClose} />);
        act(() => {
            get('.MuiDialog-container').dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
            );
        });
        expect(onClose).toHaveBeenCalled();
    });
});
