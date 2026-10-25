import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollapsibleSection } from '../src/components/CollapsibleSection';
import { cleanup, click, element, render } from './render';

afterEach(cleanup);

const header = () => element('[aria-expanded]', HTMLElement);

describe('CollapsibleSection', () => {
    it('shows the summary only while collapsed', async () => {
        render(
            <CollapsibleSection title="Git repository" summary="Not connected">
                <p>fields</p>
            </CollapsibleSection>
        );
        expect(header().getAttribute('aria-expanded')).toBe('false');
        expect(document.body.textContent).toContain('Not connected');
        await click(header());
        expect(header().getAttribute('aria-expanded')).toBe('true');
        expect(document.body.textContent).not.toContain('Not connected');
    });

    it('follows a controlled expanded and reports toggles', async () => {
        const onExpandedChange = vi.fn();
        render(
            <CollapsibleSection
                title="Git"
                summary="x"
                expanded
                onExpandedChange={onExpandedChange}
            >
                <p>fields</p>
            </CollapsibleSection>
        );
        await click(header());
        expect(onExpandedChange).toHaveBeenCalledWith(false);
        expect(header().getAttribute('aria-expanded')).toBe('true');
    });
});
