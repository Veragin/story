import '@story/shared'; // installs the global `_`
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $, click, get, mount, unmount } from '../../inputs/__tests__/dom';
import { SaveStatus } from '../SaveStatus';

describe('SaveStatus', () => {
    afterEach(unmount);

    it('renders nothing while idle', () => {
        mount(<SaveStatus status="idle" />);
        expect($('[data-status]')).toBeNull();
    });

    it('shows progress with custom labels', () => {
        mount(<SaveStatus status="pending" labels={{ saving: 'Saving layout…' }} />);
        expect(get('[data-status="pending"]').textContent).toBe('Saving layout…');
    });

    it('hides progress when only errors are wanted', () => {
        mount(<SaveStatus status="saved" errorsOnly />);
        expect($('[data-status]')).toBeNull();
    });

    it('reports a failure with a Retry button', () => {
        const onRetry = vi.fn();
        mount(<SaveStatus status="error" error="Disk full" onRetry={onRetry} errorsOnly />);
        expect(get('[data-status="error"]').textContent).toBe('Save failedRetry');
        click('[data-status="error"] button');
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it('omits Retry without a handler', () => {
        mount(<SaveStatus status="error" />);
        expect($('[data-status="error"] button')).toBeNull();
    });
});
