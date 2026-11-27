import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { LoadErrorState } from '../LoadErrorState';

describe('LoadErrorState', () => {
    afterEach(unmount);

    it('shows the message and retries on click', () => {
        const onRetry = vi.fn();
        mount(<LoadErrorState message="Could not load" onRetry={onRetry} />);
        expect(get('.MuiAlert-message').textContent).toBe('Could not load');
        click('.MuiAlert-action button');
        expect(onRetry).toHaveBeenCalledOnce();
    });
});
