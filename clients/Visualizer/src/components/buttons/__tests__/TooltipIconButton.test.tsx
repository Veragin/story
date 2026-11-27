import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeleteIcon from '@mui/icons-material/Delete';
import { $, click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { TooltipIconButton } from '../TooltipIconButton';

describe('TooltipIconButton', () => {
    afterEach(unmount);

    it('labels the button with its title inside a span wrapper', () => {
        const onClick = vi.fn();
        mount(
            <TooltipIconButton
                title="Delete row"
                icon={DeleteIcon}
                data-action="delete-row"
                onClick={onClick}
            />
        );
        const button = get('button[data-action="delete-row"]');
        expect(button.getAttribute('aria-label')).toBe('Delete row');
        expect(button.parentElement?.tagName).toBe('SPAN');
        expect($('span[aria-label]')).toBeNull();
        expect(button.classList.contains('MuiIconButton-sizeSmall')).toBe(true);
        expect($('button svg.MuiSvgIcon-fontSizeSmall')).not.toBeNull();

        click('button[data-action="delete-row"]');
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('maps the tone to the button colour', () => {
        mount(
            <TooltipIconButton title="Delete" icon={DeleteIcon} tone="error" />
        );
        expect(
            get('button').classList.contains('MuiIconButton-colorError')
        ).toBe(true);
    });

    it('reports the pressed state and shows a spinner while busy', () => {
        mount(
            <TooltipIconButton title="Toggle" icon={DeleteIcon} pressed busy />
        );
        const button = get<HTMLButtonElement>('button');
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.disabled).toBe(true);
        expect($('button .MuiCircularProgress-root')).not.toBeNull();
    });
});
