import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormCheckbox } from '../FormCheckbox';
import { click, get, mount, unmount } from '../../inputs/__tests__/dom';

const BOX = 'input[aria-label="Awake"]';

describe('FormCheckbox', () => {
    afterEach(unmount);

    it('shows the label as the field caption and toggles', () => {
        const onChange = vi.fn();
        mount(
            <FormCheckbox
                label="Awake"
                value={false}
                onChange={onChange}
                dataField="awake"
            />
        );
        expect(get('[data-form-field="Awake"]').textContent).toContain('Awake');
        expect(get('[data-field="awake"]')).not.toBeNull();
        click(BOX);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('adds an optional missing value as unchecked', () => {
        const onChange = vi.fn();
        mount(
            <FormCheckbox
                label="Awake"
                value={undefined}
                onChange={onChange}
                optional
            />
        );
        click('[data-action="add-field"]');
        expect(onChange).toHaveBeenCalledWith(false);
    });
});
